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
 * Refex Winter Campaign — weekly prize inventory (IST Monday–Sunday).
 *
 * Each new week starts again at the same quantities:
 *   ₹2,000 × 2, ₹5,000 × 2, ₹7,000 × 1, ₹10,000 × 1.
 * Every other spin is an independent coin flip between Better Luck Next Time
 * and Eligible for Bumper Prize through Lucky Draw. There is no fixed count
 * for either of those.
 */
const PRIZES = [
  {
    code: "better_luck",
    label: "Better Luck Next Time",
    shortLabel: "Better Luck Next Time",
    isWin: false,
    weeklyCap: null,
  },
  {
    code: "win_2000",
    label: "Gift worth up to ₹2,000",
    shortLabel: "Gift up to ₹2,000",
    isWin: true,
    weeklyCap: 2,
  },
  {
    code: "win_5000",
    label: "Gift worth up to ₹5,000",
    shortLabel: "Gift up to ₹5,000",
    isWin: true,
    weeklyCap: 2,
  },
  {
    code: "win_7000",
    label: "Gift worth up to ₹7,000",
    shortLabel: "Gift up to ₹7,000",
    isWin: true,
    weeklyCap: 1,
  },
  {
    code: "win_10000",
    label: "Gift worth up to ₹10,000",
    shortLabel: "Gift up to ₹10,000",
    isWin: true,
    weeklyCap: 1,
  },
  {
    code: "bumper",
    label: "Eligible for Bumper Gift through Lucky Draw",
    shortLabel: "Bumper Gift Lucky Draw",
    isWin: true,
    weeklyCap: null,
  },
];

const PRIZE_BY_CODE = Object.fromEntries(PRIZES.map((p) => [p.code, p]));

const CAMPAIGN_END = process.env.WINTER_SPIN_END_DATE || "2027-01-15";
const CAMPAIGN_START = process.env.WINTER_SPIN_START_DATE || "2026-11-09";

/**
 * Opening estimate of spins per day, used only until this week has a real sample.
 * After that, the week's own pace spreads the six cash prizes across the days left.
 */
const EST_SPINS_PER_DAY = Number(process.env.WINTER_SPIN_EST_SPINS_PER_DAY || 50);
const PACE_SAMPLE_SPINS = 8;

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
  return today <= CAMPAIGN_END;
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

function campaignClosedMessage() {
  return "The Refex Winter Carnival contest is over.";
}

function mapEntry(entry) {
  if (!entry) return null;
  const prize = PRIZE_BY_CODE[entry.prize_code];
  return {
    prizeCode: entry.prize_code,
    prizeLabel: prize ? prize.label : entry.prize_label,
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
 * Spins still expected after this one. Sunday (or the last day) returns 0 so
 * any cash still in stock is awarded before the week ends. A brand-new week
 * uses the daily estimate; once eight people have spun, the week's own rate
 * takes over and a quiet week still gives out its six cash prizes.
 */
function expectedFutureSpins(spinsSoFar, date = new Date()) {
  const futureDays = Math.max(0, getRemainingDaysInWeek(date) - 1);
  if (futureDays === 0) return 0;

  const prior = Math.max(1, EST_SPINS_PER_DAY);
  if (spinsSoFar < PACE_SAMPLE_SPINS) return futureDays * prior;

  const observed = spinsSoFar / Math.max(1, getIstWeekdayNumber(date));
  return futureDays * Math.max(1, observed);
}

/** True when this spin should take one of the week's remaining cash slots. */
function shouldAwardCash(remainingSlots, spinsSoFar, date = new Date()) {
  if (remainingSlots <= 0) return false;
  const horizon = expectedFutureSpins(spinsSoFar, date) + 1;
  const probability = Math.min(1, remainingSlots / horizon);
  const scale = 1_000_000;
  const threshold = Math.floor(probability * scale);
  return crypto.randomInt(0, scale) < threshold;
}

function pickOpenOutcome() {
  return crypto.randomInt(0, 2) === 0
    ? PRIZE_BY_CODE.better_luck
    : PRIZE_BY_CODE.bumper;
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
  await ensureWeeklyStock(weekKey, transaction);

  const stocks = await WinterSpinWeeklyStock.findAll({
    where: { week_key: weekKey },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const spinsSoFar = await WinterSpinEntry.count({
    where: { week_key: weekKey },
    transaction,
  });

  let cashChoices = stocks
    .map((row) => ({
      prize: PRIZE_BY_CODE[row.prize_code],
      weight: Number(row.cap) - Number(row.used),
    }))
    .filter((row) => row.prize && row.prize.weeklyCap != null && row.weight > 0);

  const remainingSlots = cashChoices.reduce((sum, row) => sum + row.weight, 0);

  if (shouldAwardCash(remainingSlots, spinsSoFar)) {
    for (let attempt = 0; attempt < cashChoices.length; attempt += 1) {
      const picked = cryptoWeightedPick(cashChoices);
      if (!picked?.prize) break;
      const ok = await consumeWeeklyStock(weekKey, picked.prize.code, transaction);
      if (ok) return picked.prize;
      cashChoices = cashChoices.filter((row) => row.prize.code !== picked.prize.code);
      if (!cashChoices.length) break;
    }
  }

  return pickOpenOutcome();
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
  return `/winter-carnival/spin?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(
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
      message: campaignClosedMessage(),
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
    campaignStart: CAMPAIGN_START,
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
      message: campaignClosedMessage(),
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
      try {
        await winterCampaignEmailService.sendThankYouOnce(cleanPhone);
      } catch (mailError) {
        console.error("Winter campaign thank-you email failed:", mailError.message);
      }
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
