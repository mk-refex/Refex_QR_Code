const crypto = require("crypto");
const {
  sequelize,
  WinterSpinEntry,
  WinterSpinWeeklyStock,
  WinterSpinToken,
} = require("../models");
const winterCampaignEmailService = require("./winterCampaignEmailService");

/** Shared secret for trusted server-to-server token issue calls. */
const ISSUE_API_KEY = process.env.WINTER_SPIN_API_KEY || "";
/** Token lifetime in hours (default 72h). */
const TOKEN_TTL_HOURS = Number(process.env.WINTER_SPIN_TOKEN_TTL_HOURS || 72);
/** Public site base for issued redirect URLs. */
const PUBLIC_BASE_URL = (
  process.env.WINTER_SPIN_PUBLIC_BASE_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:3030"
).replace(/\/$/, "");

/**
 * Refex Winter Campaign — prize catalog & weekly caps (IST weeks).
 *
 * Most spins land on Better Luck Next Time.
 * Cash prizes are rare, weekly-capped, and paced so they can fall on any day
 * (not burned on Monday). Bumper is unlimited but still uncommon.
 */
const PRIZES = [
  {
    code: "better_luck",
    label: "Better Luck Next Time",
    shortLabel: "Better Luck Next Time",
    isWin: false,
    weeklyCap: null,
    weight: 900,
  },
  {
    code: "win_2000",
    label: "Win up to ₹2,000",
    shortLabel: "Win up to ₹2,000",
    isWin: true,
    weeklyCap: 2,
    weight: 12,
  },
  {
    code: "win_5000",
    label: "Win up to ₹5,000",
    shortLabel: "Win up to ₹5,000",
    isWin: true,
    weeklyCap: 2,
    weight: 8,
  },
  {
    code: "win_7000",
    label: "Win up to ₹7,000",
    shortLabel: "Win up to ₹7,000",
    isWin: true,
    weeklyCap: 1,
    weight: 5,
  },
  {
    code: "win_10000",
    label: "Win up to ₹10,000",
    shortLabel: "Win up to ₹10,000",
    isWin: true,
    weeklyCap: 1,
    weight: 3,
  },
  {
    code: "bumper",
    label: "Eligible for Bumper Prize through Lucky Draw",
    shortLabel: "Bumper Prize Lucky Draw",
    isWin: true,
    weeklyCap: null,
    weight: 72,
  },
];

const PRIZE_BY_CODE = Object.fromEntries(PRIZES.map((p) => [p.code, p]));

const CAMPAIGN_END = process.env.WINTER_SPIN_END_DATE || "2027-01-15";
const CAMPAIGN_START = process.env.WINTER_SPIN_START_DATE || "2026-11-01";

/** First-roll: % of spins that instantly become Better Luck (before secondary lottery). */
const BETTER_LUCK_FLOOR_PCT = Number(process.env.WINTER_SPIN_BETTER_LUCK_PCT || 88);

/** Estimated spins/day — used only to pace remaining weekly cash prizes across remaining days. */
const EST_SPINS_PER_DAY = Number(process.env.WINTER_SPIN_EST_SPINS_PER_DAY || 50);

function getIstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return parts;
}

/** Monday-start week key in Asia/Kolkata, e.g. 2026-11-03 */
function getWeekKey(date = new Date()) {
  const parts = getIstParts(date);
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = weekdayMap[parts.weekday] || 1;
  const monday = new Date(utcNoon);
  monday.setUTCDate(utcNoon.getUTCDate() - (weekday - 1));
  const yy = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getIstDateString(date = new Date()) {
  const parts = getIstParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isCampaignActive(date = new Date()) {
  const today = getIstDateString(date);
  return today >= CAMPAIGN_START && today <= CAMPAIGN_END;
}

function normalizePhone(raw) {
  if (raw == null) return "";
  // Keep the country code. The public form stores dial code + national number.
  return String(raw).replace(/\D/g, "").slice(0, 15);
}

function isValidPhone(digits) {
  if (!/^\d{8,15}$/.test(digits)) return false;
  // New Indian entries are 91 plus a 10-digit mobile. A 10-digit value that
  // happens to start with 91 is an older national number, not a country code.
  if (digits.startsWith("91") && digits.length !== 10) {
    return /^91[6-9]\d{9}$/.test(digits);
  }
  return true;
}

function normalizeName(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function normalizeToken(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  return value.slice(0, 255);
}

function mapEntry(entry) {
  if (!entry) return null;
  return {
    prizeCode: entry.prize_code,
    prizeLabel: entry.prize_label,
    isWin: entry.is_win,
    weekKey: entry.week_key,
    spunAt: entry.spun_at,
  };
}

async function openSpinSession(token) {
  const cleanToken = normalizeToken(token);
  if (!cleanToken) {
    return { ok: false, status: 403, message: "Access denied." };
  }

  const record = await WinterSpinToken.findOne({ where: { token: cleanToken } });
  if (!record) {
    return { ok: false, status: 403, message: "Access denied." };
  }
  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 403, message: "Access denied. This spin session has expired." };
  }

  return {
    ok: true,
    cleanName: normalizeName(record.name),
    cleanPhone: record.phone,
    cleanToken: record.token,
  };
}

function cryptoWeightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  const roll = crypto.randomInt(0, total);
  let cursor = 0;
  for (const item of items) {
    cursor += item.weight;
    if (roll < cursor) return item;
  }
  return items[items.length - 1];
}

/** Mon=1 … Sun=7 in Asia/Kolkata */
function getIstWeekdayNumber(date = new Date()) {
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return weekdayMap[getIstParts(date).weekday] || 1;
}

/** Days left in the IST week including today (1–7). */
function getRemainingDaysInWeek(date = new Date()) {
  return 8 - getIstWeekdayNumber(date);
}

/**
 * Soft random gate so remaining weekly cash slots can land on any remaining day.
 * Early-week spins mostly skip cash; late-week unused slots become more likely.
 */
function pacingAllowsCappedPrize(remainingSlots, remainingDays) {
  if (remainingSlots <= 0) return false;
  const estSpinsLeft = Math.max(
    remainingSlots,
    remainingDays * Math.max(1, EST_SPINS_PER_DAY)
  );
  const probability = remainingSlots / estSpinsLeft;
  const scale = 1_000_000;
  const threshold = Math.max(1, Math.floor(probability * scale));
  return crypto.randomInt(0, scale) < threshold;
}

async function ensureWeeklyStock(weekKey, transaction) {
  const capped = PRIZES.filter((p) => p.weeklyCap != null);
  for (const prize of capped) {
    const [row] = await WinterSpinWeeklyStock.findOrCreate({
      where: { week_key: weekKey, prize_code: prize.code },
      defaults: {
        week_key: weekKey,
        prize_code: prize.code,
        cap: prize.weeklyCap,
        used: 0,
      },
      transaction,
    });
    if (row.cap !== prize.weeklyCap) {
      await row.update({ cap: prize.weeklyCap }, { transaction });
    }
  }
}

async function getAvailablePrizes(weekKey, transaction) {
  await ensureWeeklyStock(weekKey, transaction);

  const stocks = await WinterSpinWeeklyStock.findAll({
    where: { week_key: weekKey },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const usedByCode = Object.fromEntries(
    stocks.map((s) => [s.prize_code, { used: s.used, cap: s.cap }])
  );
  const remainingDays = getRemainingDaysInWeek();

  return PRIZES.filter((prize) => {
    if (prize.weeklyCap == null) return true;
    const stock = usedByCode[prize.code];
    if (!stock) return true;
    const remaining = stock.cap - stock.used;
    if (remaining <= 0) return false;
    // Random day pacing — prize can appear any day, not all at once
    return pacingAllowsCappedPrize(remaining, remainingDays);
  }).map((prize) => ({ ...prize }));
}

async function consumeWeeklyStock(weekKey, prizeCode, transaction) {
  const prize = PRIZE_BY_CODE[prizeCode];
  if (!prize || prize.weeklyCap == null) return true;

  const [, meta] = await sequelize.query(
    `UPDATE winter_spin_weekly_stock
     SET used = used + 1
     WHERE week_key = :weekKey
       AND prize_code = :prizeCode
       AND used < cap`,
    {
      replacements: { weekKey, prizeCode },
      transaction,
    }
  );
  return (meta?.affectedRows || 0) > 0;
}

async function pickSecurePrize(weekKey, transaction) {
  // 1) Most spins → Better Luck Next Time (secure floor)
  const floor = Math.min(99, Math.max(0, BETTER_LUCK_FLOOR_PCT));
  if (crypto.randomInt(0, 100) < floor) {
    return PRIZE_BY_CODE.better_luck;
  }

  // 2) Secondary lottery among bumper + paced cash (and better_luck still in pool)
  let available = await getAvailablePrizes(weekKey, transaction);
  if (!available.length) {
    return PRIZE_BY_CODE.better_luck;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const picked = cryptoWeightedPick(available);
    if (!picked) break;

    if (picked.weeklyCap == null) {
      return picked;
    }

    const ok = await consumeWeeklyStock(weekKey, picked.code, transaction);
    if (ok) return picked;

    available = available.filter((p) => p.code !== picked.code);
    if (!available.length) break;
  }

  return PRIZE_BY_CODE.better_luck;
}

/**
 * Only server-issued tokens are valid. Random query strings are rejected.
 */
async function assertValidIssuedToken({ token, phone, name, forSpin = false }) {
  const cleanToken = normalizeToken(token);
  const cleanPhone = normalizePhone(phone);
  const cleanName = normalizeName(name);

  if (!cleanToken) {
    return { ok: false, status: 403, message: "Access denied. A valid token is required." };
  }
  if (!isValidPhone(cleanPhone)) {
    return { ok: false, status: 400, message: "A valid mobile number is required." };
  }
  if (!cleanName || cleanName.length < 2) {
    return { ok: false, status: 400, message: "Name is required." };
  }

  const record = await WinterSpinToken.findOne({ where: { token: cleanToken } });
  if (!record) {
    return {
      ok: false,
      status: 403,
      message: "Access denied. Invalid or unknown token.",
    };
  }

  if (record.phone !== cleanPhone) {
    return {
      ok: false,
      status: 403,
      message: "Access denied. Token does not match this phone number.",
    };
  }

  // Name must match what was registered with the token
  if (normalizeName(record.name).toLowerCase() !== cleanName.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      message: "Access denied. Token does not match this name.",
    };
  }

  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      status: 403,
      message: "Access denied. This spin link has expired.",
    };
  }

  if (forSpin && record.used_at) {
    // Spin may still return existing entry for this phone; flag for caller
    return {
      ok: true,
      tokenRecord: record,
      tokenAlreadyUsed: true,
      cleanName,
      cleanPhone,
      cleanToken,
    };
  }

  return {
    ok: true,
    tokenRecord: record,
    tokenAlreadyUsed: Boolean(record.used_at),
    cleanName,
    cleanPhone,
    cleanToken,
  };
}

function isIssueApiKeyValid(providedKey) {
  if (!ISSUE_API_KEY) return false;
  const a = Buffer.from(String(providedKey || "").trim());
  const b = Buffer.from(String(ISSUE_API_KEY).trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function buildSpinPath(name, phone, token) {
  return `/winter-spin?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(
    phone
  )}&token=${encodeURIComponent(token)}`;
}

/**
 * Create or reuse a spin token. Used by our public campaign form.
 */
async function mintSpinAccess({ name, phone }) {
  const cleanName = normalizeName(name);
  const cleanPhone = normalizePhone(phone);

  if (!cleanName || cleanName.length < 2) {
    return { ok: false, status: 400, message: "Name is required." };
  }
  if (!isValidPhone(cleanPhone)) {
    return {
      ok: false,
      status: 400,
      message: "A valid mobile number is required.",
    };
  }
  if (!isCampaignActive()) {
    return {
      ok: false,
      status: 403,
      message: "The Refex Winter Campaign spin has ended.",
    };
  }

  // Reuse unused non-expired token for same phone if present
  const existing = await WinterSpinToken.findOne({
    where: { phone: cleanPhone, used_at: null },
    order: [["id", "DESC"]],
  });
  if (
    existing &&
    (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now())
  ) {
    const spinPath = buildSpinPath(existing.name, existing.phone, existing.token);
    return {
      ok: true,
      reused: true,
      token: existing.token,
      name: existing.name,
      phone: existing.phone,
      expiresAt: existing.expires_at,
      spinPath,
      spinUrl: `${PUBLIC_BASE_URL}${spinPath}`,
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + Math.max(1, TOKEN_TTL_HOURS) * 60 * 60 * 1000);

  await WinterSpinToken.create({
    token,
    name: cleanName,
    phone: cleanPhone,
    created_at: new Date(),
    expires_at: expiresAt,
    used_at: null,
  });

  const spinPath = buildSpinPath(cleanName, cleanPhone, token);

  return {
    ok: true,
    reused: false,
    token,
    name: cleanName,
    phone: cleanPhone,
    expiresAt,
    spinPath,
    spinUrl: `${PUBLIC_BASE_URL}${spinPath}`,
  };
}

/**
 * Trusted server-to-server issue. The public form uses mintSpinAccess directly.
 */
async function getSessionStatus(token) {
  const session = await openSpinSession(token);
  if (!session.ok) return { ok: false, status: session.status, error: session.message };
  return getStatus({
    phone: session.cleanPhone,
    name: session.cleanName,
    token: session.cleanToken,
  });
}

async function spinSession({ token, ip, userAgent }) {
  const session = await openSpinSession(token);
  if (!session.ok) return { ok: false, status: session.status, message: session.message };
  return spinOnce({
    name: session.cleanName,
    phone: session.cleanPhone,
    token: session.cleanToken,
    ip,
    userAgent,
  });
}

async function issueSpinToken({ name, phone, apiKey }) {
  if (!ISSUE_API_KEY) {
    return {
      ok: false,
      status: 503,
      message: "Token issuing is not configured (WINTER_SPIN_API_KEY).",
    };
  }
  if (!isIssueApiKeyValid(apiKey)) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }
  return mintSpinAccess({ name, phone });
}

async function getStatus({ phone, name, token }) {
  const access = await assertValidIssuedToken({
    token,
    phone,
    name,
    forSpin: false,
  });
  if (!access.ok) {
    return { ok: false, status: access.status, error: access.message };
  }

  const entry = await WinterSpinEntry.findOne({
    where: { phone: access.cleanPhone },
  });
  const weekKey = getWeekKey();
  const campaignActive = isCampaignActive();

  return {
    ok: true,
    campaignActive,
    campaignEnd: CAMPAIGN_END,
    weekKey,
    alreadySpun: Boolean(entry),
    entry: mapEntry(entry),
    segments: PRIZES.map((p) => ({
      code: p.code,
      label: p.shortLabel,
      isWin: p.isWin,
    })),
  };
}

async function spinOnce({ name, phone, token, ip, userAgent }) {
  const access = await assertValidIssuedToken({
    token,
    phone,
    name,
    forSpin: true,
  });
  if (!access.ok) {
    return { ok: false, status: access.status, message: access.message };
  }

  const { cleanName, cleanPhone, cleanToken } = access;

  if (!isCampaignActive()) {
    return {
      ok: false,
      status: 403,
      message: "The Refex Winter Campaign spin has ended.",
    };
  }

  const weekKey = getWeekKey();

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const existing = await WinterSpinEntry.findOne({
        where: { phone: cleanPhone },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existing) {
        return {
          alreadySpun: true,
          entry: existing,
        };
      }

      // Lock token row so the same link cannot be raced
      const lockedToken = await WinterSpinToken.findOne({
        where: { token: cleanToken },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lockedToken || lockedToken.phone !== cleanPhone) {
        throw Object.assign(new Error("Invalid token"), { status: 403 });
      }
      if (lockedToken.used_at) {
        const usedEntry = await WinterSpinEntry.findOne({
          where: { phone: cleanPhone },
          transaction,
        });
        if (usedEntry) {
          return { alreadySpun: true, entry: usedEntry };
        }
      }

      const prize = await pickSecurePrize(weekKey, transaction);

      const entry = await WinterSpinEntry.create(
        {
          name: cleanName,
          phone: cleanPhone,
          token: cleanToken,
          prize_code: prize.code,
          prize_label: prize.label,
          is_win: prize.isWin,
          week_key: weekKey,
          spun_at: new Date(),
          user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
          ip_address: ip ? String(ip).slice(0, 64) : null,
        },
        { transaction }
      );

      await lockedToken.update({ used_at: new Date() }, { transaction });

      return { alreadySpun: false, entry, prize };
    });

    if (!result.alreadySpun && result.entry && !result.entry.is_win) {
      await winterCampaignEmailService.sendThankYouOnce(cleanPhone);
    }

    return {
      ok: true,
      alreadySpun: result.alreadySpun,
      weekKey,
      entry: mapEntry(result.entry),
    };
  } catch (error) {
    if (error.status === 403) {
      return { ok: false, status: 403, message: "Access denied. Invalid token." };
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      const entry = await WinterSpinEntry.findOne({
        where: { phone: cleanPhone },
      });
      if (entry) {
        return {
          ok: true,
          alreadySpun: true,
          weekKey,
          entry: mapEntry(entry),
        };
      }
    }
    throw error;
  }
}

module.exports = {
  PRIZES,
  PRIZE_BY_CODE,
  getWeekKey,
  isCampaignActive,
  normalizePhone,
  isValidPhone,
  normalizeName,
  getStatus,
  getStatusByPhone: getStatus,
  mintSpinAccess,
  issueSpinToken,
  getSessionStatus,
  spinSession,
  spinOnce,
};
