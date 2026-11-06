const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { WinterCampaignSubmission, WinterCampaignBill } = require("../models");
const winterSpinService = require("./winterSpinService");
const winterCaptchaService = require("./winterCaptchaService");

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidName(name) {
  return /^[\p{L}][\p{L}\s.'-]{1,119}$/u.test(name);
}

function isValidEmail(email) {
  return (
    email.length <= 180 &&
    /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)
  );
}

function removeUploaded(files) {
  (files || []).forEach((file) => {
    if (file && file.path) {
      fs.unlink(file.path, () => {});
    }
  });
}

async function registerSubmission({
  name,
  email,
  phone,
  consent,
  files,
  ip,
  userAgent,
  captchaToken,
  captchaAnswer,
}) {
  if (!winterCaptchaService.allowRegister(ip)) {
    removeUploaded(files);
    return {
      ok: false,
      status: 429,
      message: "Too many attempts. Please wait a few minutes and try again.",
    };
  }
  if (!winterCaptchaService.verifyCaptcha(captchaToken, captchaAnswer)) {
    removeUploaded(files);
    return {
      ok: false,
      status: 400,
      message: "Enter the security code shown in the image.",
    };
  }

  const cleanEmail = normalizeEmail(email);
  const cleanName = winterSpinService.normalizeName(name);
  const cleanPhone = winterSpinService.normalizePhone(phone);
  const agreed = consent === true || consent === "true" || consent === "1" || consent === "on";

  if (!isValidName(cleanName)) {
    removeUploaded(files);
    return {
      ok: false,
      status: 400,
      message: "Enter a valid name using letters, spaces, hyphens, or apostrophes.",
    };
  }
  if (!isValidEmail(cleanEmail)) {
    removeUploaded(files);
    return { ok: false, status: 400, message: "A valid email address is required." };
  }
  if (!winterSpinService.isValidPhone(cleanPhone)) {
    removeUploaded(files);
    return { ok: false, status: 400, message: "A valid mobile number with country code is required." };
  }
  if (!agreed) {
    removeUploaded(files);
    return { ok: false, status: 400, message: "Please agree to the campaign terms to continue." };
  }

  const existing = await WinterCampaignSubmission.findOne({
    where: { [Op.or]: [{ email: cleanEmail }, { phone: cleanPhone }] },
  });

  if (existing) {
    removeUploaded(files);
    const access = await winterSpinService.mintSpinAccess({
      name: existing.name,
      phone: existing.phone,
    });
    if (!access.ok) return access;
    return {
      ok: true,
      alreadyRegistered: true,
      message: "This email or phone has already been submitted. Opening your spin.",
      spinPath: "/winter-spin",
      sessionToken: access.token,
      expiresAt: access.expiresAt,
    };
  }

  if (!files || !files.length) {
    return { ok: false, status: 400, message: "Upload a clear photo or PDF of your purchase bill." };
  }
  if (files.length > 5) {
    removeUploaded(files);
    return { ok: false, status: 400, message: "You can upload up to 5 bill files." };
  }

  const access = await winterSpinService.mintSpinAccess({
    name: cleanName,
    phone: cleanPhone,
  });
  if (!access.ok) {
    removeUploaded(files);
    return access;
  }

  try {
    const submission = await WinterCampaignSubmission.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      consent: true,
      token: access.token,
      created_at: new Date(),
      ip_address: ip ? String(ip).slice(0, 64) : null,
      user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    });

    await WinterCampaignBill.bulkCreate(
      files.map((file) => ({
        submission_id: submission.id,
        original_name: path.basename(file.originalname || "bill").slice(0, 255),
        stored_name: path.basename(file.filename),
        mime_type: file.mimetype ? String(file.mimetype).slice(0, 120) : null,
        size_bytes: file.size || 0,
        created_at: new Date(),
      }))
    );

    return {
      ok: true,
      alreadyRegistered: false,
      message: "Details saved. Opening your spin wheel.",
      spinPath: "/winter-spin",
      sessionToken: access.token,
      expiresAt: access.expiresAt,
    };
  } catch (error) {
    removeUploaded(files);
    if (error.name === "SequelizeUniqueConstraintError") {
      const again = await WinterCampaignSubmission.findOne({
        where: { [Op.or]: [{ email: cleanEmail }, { phone: cleanPhone }] },
      });
      if (again) {
        const retry = await winterSpinService.mintSpinAccess({
          name: again.name,
          phone: again.phone,
        });
        if (retry.ok) {
          return {
            ok: true,
            alreadyRegistered: true,
            message: "This email or phone has already been submitted. Opening your spin.",
            spinPath: "/winter-spin",
            sessionToken: retry.token,
            expiresAt: retry.expiresAt,
          };
        }
      }
    }
    throw error;
  }
}

module.exports = { registerSubmission };
