const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  sequelize,
  WinterCampaignSubmission,
  WinterCampaignBill,
  WinterSpinEntry,
  WinterSpinToken,
} = require("../models");
const winterSpinService = require("./winterSpinService");

const BILLS_DIR = path.join(__dirname, "..", "..", "uploads", "winter-campaign");

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidName(name) {
  return /^[\p{L}][\p{L}\s.'-]{1,119}$/u.test(name);
}

function isValidEmail(email) {
  return email.length <= 180 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

function paging(query) {
  const page = Math.max(parseInt(query.page || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit || "10", 10) || 10, 1), 50);
  return { page, limit, offset: (page - 1) * limit };
}

function searchWhere(search, fields) {
  const term = String(search || "").trim();
  if (!term) return undefined;
  return {
    [Op.or]: fields.map((field) => ({ [field]: { [Op.like]: `%${term}%` } })),
  };
}

function mapBill(bill) {
  return {
    id: bill.id,
    originalName: bill.original_name,
    mimeType: bill.mime_type,
    sizeBytes: bill.size_bytes,
  };
}

function mapPrize(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    prizeCode: entry.prize_code,
    prizeLabel: entry.prize_label,
    isWin: entry.is_win,
    spunAt: entry.spun_at,
  };
}

async function listSubmissions(query) {
  const { page, limit, offset } = paging(query);
  const where = searchWhere(query.search, ["name", "email", "phone"]);
  const { rows, count } = await WinterCampaignSubmission.findAndCountAll({
    where,
    include: [
      {
        model: WinterCampaignBill,
        as: "bills",
        attributes: ["id", "original_name", "mime_type", "size_bytes"],
      },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const phones = rows.map((row) => row.phone);
  const entries = phones.length
    ? await WinterSpinEntry.findAll({ where: { phone: phones } })
    : [];
  const entryByPhone = new Map(entries.map((entry) => [entry.phone, entry]));

  return {
    page,
    limit,
    total: count,
    totalPage: Math.max(Math.ceil(count / limit), 1),
    records: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      consent: row.consent,
      createdAt: row.created_at,
      bills: (row.bills || []).map(mapBill),
      prize: mapPrize(entryByPhone.get(row.phone)),
    })),
  };
}

async function listWinners(query) {
  const { page, limit, offset } = paging(query);
  const where = {
    is_win: true,
    ...searchWhere(query.search, ["name", "phone", "prize_label"]),
  };
  const { rows, count } = await WinterSpinEntry.findAndCountAll({
    where,
    order: [["spun_at", "DESC"]],
    limit,
    offset,
  });
  const phones = rows.map((row) => row.phone);
  const submissions = phones.length
    ? await WinterCampaignSubmission.findAll({
        where: { phone: phones },
        attributes: ["phone", "email"],
      })
    : [];
  const emailByPhone = new Map(submissions.map((row) => [row.phone, row.email]));

  return {
    page,
    limit,
    total: count,
    totalPage: Math.max(Math.ceil(count / limit), 1),
    records: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: emailByPhone.get(row.phone) || "",
      phone: row.phone,
      prizeCode: row.prize_code,
      prizeLabel: row.prize_label,
      weekKey: row.week_key,
      spunAt: row.spun_at,
    })),
  };
}

async function billFile(id) {
  const bill = await WinterCampaignBill.findByPk(id);
  if (!bill) return { ok: false, status: 404, message: "Bill not found." };
  const root = path.resolve(BILLS_DIR);
  const filePath = path.resolve(root, path.basename(bill.stored_name));
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
    return { ok: false, status: 404, message: "Bill file is missing." };
  }
  return {
    ok: true,
    filePath,
    mimeType: bill.mime_type || "application/octet-stream",
    originalName: bill.original_name,
  };
}

async function updateSubmission(id, { name, email, phone }) {
  const submission = await WinterCampaignSubmission.findByPk(id);
  if (!submission) return { ok: false, status: 404, message: "Entry not found." };

  const cleanName = winterSpinService.normalizeName(name);
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = winterSpinService.normalizePhone(phone);

  if (!isValidName(cleanName)) {
    return { ok: false, status: 400, message: "Enter a valid name." };
  }
  if (!isValidEmail(cleanEmail)) {
    return { ok: false, status: 400, message: "Enter a valid email address." };
  }
  if (!winterSpinService.isValidPhone(cleanPhone)) {
    return { ok: false, status: 400, message: "Enter a valid mobile number." };
  }

  const clash = await WinterCampaignSubmission.findOne({
    where: {
      id: { [Op.ne]: submission.id },
      [Op.or]: [{ email: cleanEmail }, { phone: cleanPhone }],
    },
  });
  if (clash) {
    return { ok: false, status: 409, message: "Another entry already uses this email or phone." };
  }

  const previousPhone = submission.phone;
  try {
    await sequelize.transaction(async (transaction) => {
      await submission.update(
        { name: cleanName, email: cleanEmail, phone: cleanPhone },
        { transaction }
      );
      await WinterSpinToken.update(
        { name: cleanName, phone: cleanPhone },
        { where: { phone: previousPhone }, transaction }
      );
      await WinterSpinEntry.update(
        { name: cleanName, phone: cleanPhone },
        { where: { phone: previousPhone }, transaction }
      );
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return { ok: false, status: 409, message: "Another entry already uses this email or phone." };
    }
    throw error;
  }

  return { ok: true, message: "Entry updated." };
}

function removeBillFiles(bills) {
  (bills || []).forEach((bill) => {
    const root = path.resolve(BILLS_DIR);
    const filePath = path.resolve(root, path.basename(bill.stored_name || ""));
    if (filePath.startsWith(`${root}${path.sep}`)) {
      fs.unlink(filePath, () => {});
    }
  });
}

async function deleteSubmission(id) {
  const submission = await WinterCampaignSubmission.findByPk(id, {
    include: [{ model: WinterCampaignBill, as: "bills" }],
  });
  if (!submission) return { ok: false, status: 404, message: "Entry not found." };

  const bills = submission.bills || [];
  await sequelize.transaction(async (transaction) => {
    await WinterCampaignBill.destroy({ where: { submission_id: submission.id }, transaction });
    await submission.destroy({ transaction });
    await WinterSpinToken.destroy({ where: { phone: submission.phone }, transaction });
    await WinterSpinEntry.destroy({ where: { phone: submission.phone }, transaction });
  });
  removeBillFiles(bills);
  return { ok: true, message: "Entry removed." };
}

async function deleteWinner(id) {
  const entry = await WinterSpinEntry.findByPk(id);
  if (!entry || !entry.is_win) return { ok: false, status: 404, message: "Winner not found." };
  await entry.destroy();
  return { ok: true, message: "Winner removed." };
}

module.exports = {
  listSubmissions,
  listWinners,
  billFile,
  updateSubmission,
  deleteSubmission,
  deleteWinner,
};
