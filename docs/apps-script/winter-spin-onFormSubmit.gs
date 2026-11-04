/**
 * Refex Winter Campaign
 *
 * Form submit
 * 1) Append SpinAllow row ASAP (Name/Phone/Email, Status=processing)
 * 2) Call Issue API
 * 3) Update SAME row with Token + SpinUrl + Status=pending (Prize blank)
 * 4) Cache spinUrl for Web App redirect
 *
 * Thank-you Web App click
 * - Polls until SpinUrl is ready, then redirects (no phone form)
 *
 * After user spins (server can call)
 * - POST JSON { action:"updatePrize", phone|token, prize, prizeCode, apiKey }
 * - Updates SAME SpinAllow row: Status=spun + Prize
 *
 * Script properties
 *   WINTER_SPIN_API_KEY
 *   WINTER_SPIN_ISSUE_URL   = https://PUBLIC-API-HOST/api/winter-spin/issue
 *                            (must NOT be localhost — Google cannot reach your PC)
 *   SHEET_ID
 *   SPIN_TAB_NAME           = SpinAllow
 *   ADMIN_EMAIL             = optional
 */

var FORM_FIELDS = {
  name: ['Name', 'name', 'Full Name', 'full_name'],
  phone: ['Phone Number', 'Phone', 'phone', 'Mobile', 'mobile_number'],
  email: ['Email Address', 'Email', 'email'],
};

var HEADERS = [
  'Timestamp',
  'Name',
  'Phone',
  'Token',
  'Status',
  'Prize',
  'SpinUrl',
  'Email',
  'PrizeCode',
];

var COL = {
  Timestamp: 1,
  Name: 2,
  Phone: 3,
  Token: 4,
  Status: 5,
  Prize: 6,
  SpinUrl: 7,
  Email: 8,
  PrizeCode: 9,
};

var LATEST_CACHE_TTL = 30 * 60;

// ----------------------------------------------------------------------
// Form submit
// ----------------------------------------------------------------------

function onFormSubmit(e) {
  var rowNumber = null;
  try {
    if (!e || !e.namedValues) {
      throw new Error('Missing namedValues. Use installable trigger: On form submit.');
    }

    var name = String(firstValue(e.namedValues, FORM_FIELDS.name) || '')
      .trim()
      .replace(/\s+/g, ' ');
    var phone = normalizePhone(firstValue(e.namedValues, FORM_FIELDS.phone));
    var email =
      firstValue(e.namedValues, FORM_FIELDS.email) ||
      (e.response && e.response.getRespondentEmail && e.response.getRespondentEmail()) ||
      '';
    email = String(email || '').trim().toLowerCase();

    if (name.length < 2) throw new Error('Name is missing or too short.');
    if (!/^\d{10}$/.test(phone)) throw new Error('Phone must be a valid 10-digit number.');

    // 1) Post to SpinAllow immediately (so the row exists before Issue finishes)
    rowNumber = appendSpinRow_({
      timestamp: new Date(),
      name: name,
      phone: phone,
      token: '',
      status: 'processing',
      prize: '',
      spinUrl: '',
      email: email,
      prizeCode: '',
    });

    // 2) Issue API
    var issued = callIssueApi_(name, phone);

    // 3) Cache FIRST so Web App can open while Sheet update runs
    rememberSpinUrl_(issued.spinUrl, phone, email);

    // 4) Update SAME record with token + spinUrl
    updateSpinRow_(rowNumber, {
      token: issued.token,
      status: 'pending',
      spinUrl: issued.spinUrl,
    });
  } catch (err) {
    Logger.log('onFormSubmit error: ' + err);
    if (rowNumber) {
      try {
        updateSpinRow_(rowNumber, {
          status: 'error',
          prize: String(err.message || err).slice(0, 200),
        });
      } catch (ignore) {}
    }
    notifyAdmin_(err);
    throw err;
  }
}

// ----------------------------------------------------------------------
// Web App — wait until SpinUrl exists, then navigate
// ----------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutput(waitingRedirectHtml_())
    .setTitle('Opening Winter Spin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called by the waiting page every ~700ms until SpinUrl is ready.
 */
function pollSpinUrl() {
  try {
    var spinUrl = resolveSpinUrlForVisitor_();
    if (spinUrl) return { ok: true, ready: true, spinUrl: spinUrl };
    return { ok: true, ready: false };
  } catch (err) {
    return { ok: false, ready: false, message: String(err.message || err) };
  }
}

/**
 * Prize write-back for the SAME SpinAllow row.
 * POST body (JSON):
 * {
 *   "action": "updatePrize",
 *   "apiKey": "...",
 *   "phone": "9876543210",   // or "token": "..."
 *   "prize": "Better Luck Next Time",
 *   "prizeCode": "better_luck",
 *   "status": "spun"
 * }
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('WINTER_SPIN_API_KEY') || '';
    if (!expected || body.apiKey !== expected) {
      return jsonOutput_({ ok: false, message: 'Unauthorized' });
    }

    if (body.action !== 'updatePrize') {
      return jsonOutput_({ ok: false, message: 'Unknown action' });
    }

    var updated = updatePrizeOnSheet_({
      phone: body.phone,
      token: body.token,
      prize: body.prize || body.prizeLabel || '',
      prizeCode: body.prizeCode || '',
      status: body.status || 'spun',
    });

    return jsonOutput_({ ok: updated.ok, message: updated.message, row: updated.row });
  } catch (err) {
    return jsonOutput_({ ok: false, message: String(err.message || err) });
  }
}

// ----------------------------------------------------------------------
// Issue + remember
// ----------------------------------------------------------------------

function callIssueApi_(name, phone) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('WINTER_SPIN_API_KEY');
  var issueUrl = props.getProperty('WINTER_SPIN_ISSUE_URL');

  if (!apiKey || !issueUrl) {
    throw new Error('Set WINTER_SPIN_API_KEY and WINTER_SPIN_ISSUE_URL.');
  }
  if (/localhost|127\.0\.0\.1/i.test(issueUrl)) {
    throw new Error(
      'WINTER_SPIN_ISSUE_URL cannot be localhost. Google Apps Script must reach a public API URL.'
    );
  }

  var res = UrlFetchApp.fetch(issueUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-API-Key': apiKey },
    payload: JSON.stringify({ name: name, phone: phone }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    throw new Error('Issue API non-JSON (' + code + '): ' + text.slice(0, 300));
  }

  if (code < 200 || code >= 300 || !parsed.status) {
    throw new Error('Issue API failed (' + code + '): ' + (parsed.message || text));
  }

  var results = parsed.results || {};
  if (!results.token || !results.spinUrl) {
    throw new Error('Issue API missing token/spinUrl: ' + text.slice(0, 300));
  }

  return {
    token: results.token,
    spinUrl: results.spinUrl,
    expiresAt: results.expiresAt,
    reused: results.reused,
  };
}

function rememberSpinUrl_(spinUrl, phone, email) {
  var cache = CacheService.getScriptCache();
  cache.put('latest_spin_url', spinUrl, LATEST_CACHE_TTL);
  cache.put('latest_spin_phone', phone || '', LATEST_CACHE_TTL);
  if (email) cache.put('spin_url_email_' + email, spinUrl, LATEST_CACHE_TTL);
}

function resolveSpinUrlForVisitor_() {
  var cache = CacheService.getScriptCache();
  var email = '';
  try {
    email = String(Session.getActiveUser().getEmail() || '')
      .trim()
      .toLowerCase();
  } catch (ignore) {}

  if (email) {
    var byEmailCache = cache.get('spin_url_email_' + email);
    if (byEmailCache) return byEmailCache;
    var byEmail = findLatestSpinRow_({ email: email, requireSpinUrl: true });
    if (byEmail) return byEmail.spinUrl;
  }

  var latest = cache.get('latest_spin_url');
  if (latest) return latest;

  var newest = findLatestSpinRow_({ requireSpinUrl: true });
  if (newest) return newest.spinUrl;

  return '';
}

// ----------------------------------------------------------------------
// Sheet helpers
// ----------------------------------------------------------------------

function getSpinSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  var tabName = props.getProperty('SPIN_TAB_NAME') || 'SpinAllow';
  if (!sheetId) throw new Error('SHEET_ID not set.');

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADERS);
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

/** Returns 1-based row number of the new record. */
function appendSpinRow_(row) {
  var sheet = getSpinSheet_();
  sheet.appendRow([
    row.timestamp,
    row.name,
    row.phone,
    row.token || '',
    row.status || 'processing',
    row.prize || '',
    row.spinUrl || '',
    row.email || '',
    row.prizeCode || '',
  ]);
  SpreadsheetApp.flush(); // push to Sheet immediately
  return sheet.getLastRow();
}

function updateSpinRow_(rowNumber, fields) {
  var sheet = getSpinSheet_();
  if (!rowNumber || rowNumber < 2) return;

  if (fields.token != null) sheet.getRange(rowNumber, COL.Token).setValue(fields.token);
  if (fields.status != null) sheet.getRange(rowNumber, COL.Status).setValue(fields.status);
  if (fields.prize != null) sheet.getRange(rowNumber, COL.Prize).setValue(fields.prize);
  if (fields.spinUrl != null) sheet.getRange(rowNumber, COL.SpinUrl).setValue(fields.spinUrl);
  if (fields.prizeCode != null) sheet.getRange(rowNumber, COL.PrizeCode).setValue(fields.prizeCode);
  SpreadsheetApp.flush();
}

function updatePrizeOnSheet_(opts) {
  var phone = normalizePhone(opts.phone || '');
  var token = String(opts.token || '').trim();
  if (!phone && !token) return { ok: false, message: 'phone or token required' };

  var sheet = getSpinSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return { ok: false, message: 'No rows' };

  var values = sheet.getRange(2, 1, last, HEADERS.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    var rowPhone = normalizePhone(r[2]);
    var rowToken = String(r[3] || '').trim();
    var match = (phone && rowPhone === phone) || (token && rowToken === token);
    if (!match) continue;

    var rowNumber = i + 2;
    updateSpinRow_(rowNumber, {
      status: opts.status || 'spun',
      prize: opts.prize || '',
      prizeCode: opts.prizeCode || '',
    });
    return { ok: true, message: 'Updated', row: rowNumber };
  }

  return { ok: false, message: 'Row not found' };
}

function findLatestSpinRow_(opts) {
  var sheet = getSpinSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;

  var values = sheet.getRange(2, 1, last, HEADERS.length).getValues();
  var phone = opts.phone ? normalizePhone(opts.phone) : '';
  var email = opts.email ? String(opts.email).trim().toLowerCase() : '';
  var requireSpinUrl = opts.requireSpinUrl !== false;

  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    var rowPhone = normalizePhone(r[2]);
    var rowEmail = String(r[7] || '')
      .trim()
      .toLowerCase();
    var spinUrl = String(r[6] || '').trim();
    if (requireSpinUrl && !spinUrl) continue;

    if (phone && rowPhone !== phone) continue;
    if (email && rowEmail !== email) continue;

    return {
      rowNumber: i + 2,
      name: r[1],
      phone: rowPhone,
      token: r[3],
      status: r[4],
      prize: r[5],
      spinUrl: spinUrl,
      email: rowEmail,
      prizeCode: r[8],
    };
  }
  return null;
}

// ----------------------------------------------------------------------
// Helpers / UI
// ----------------------------------------------------------------------

function normalizePhone(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) return digits.slice(2);
  if (digits.length === 11 && digits.charAt(0) === '0') return digits.slice(1);
  return digits;
}

function firstValue(namedValues, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (
      namedValues[key] &&
      namedValues[key][0] != null &&
      String(namedValues[key][0]).trim() !== ''
    ) {
      return namedValues[key][0];
    }
  }
  return '';
}

function notifyAdmin_(err) {
  var admin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!admin) return;
  try {
    MailApp.sendEmail(
      admin,
      '[Winter Spin] Form submit failed',
      String(err && err.stack ? err.stack : err)
    );
  } catch (mailErr) {
    Logger.log('Admin notify failed: ' + mailErr);
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function waitingRedirectHtml_() {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<base target="_top">',
    '<style>',
    'body{font-family:Arial,sans-serif;background:#0B2744;color:#fff;min-height:100vh;margin:0;',
    'display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;}',
    'p{opacity:.85;max-width:420px;line-height:1.5;}',
    '.spin{width:36px;height:36px;border:3px solid rgba(255,255,255,.25);border-top-color:#F5B400;',
    'border-radius:50%;margin:0 auto 16px;animation:r .8s linear infinite;}',
    '@keyframes r{to{transform:rotate(360deg)}}',
    '.err{color:#FFB4A8;display:none;margin-top:12px;}',
    '</style></head><body>',
    '<div><div class="spin"></div>',
    '<p id="msg">Preparing your spin link…</p>',
    '<p class="err" id="err"></p></div>',
    '<script>',
    'var tries=0,maxTries=40;', // ~28s
    'var msg=document.getElementById("msg");',
    'var err=document.getElementById("err");',
    'function openSpin(u){',
    ' try{window.top.location.href=u;}catch(e1){',
    '  try{window.location.replace(u);}catch(e2){',
    '   var w=window.open(u,"_blank");',
    '   if(!w){err.style.display="block";err.textContent="Open this link: "+u;}',
    ' }}}',
    'function tick(){',
    ' tries++;',
    ' google.script.run',
    '  .withSuccessHandler(function(res){',
    '    if(res&&res.ready&&res.spinUrl){msg.textContent="Opening…";openSpin(res.spinUrl);return;}',
    '    if(tries>=maxTries){',
    '      msg.textContent="Spin link not ready yet.";',
    '      err.style.display="block";',
    '      err.textContent="Submit the form again, wait 2–3 seconds, then reopen this page. Also check Issue API is a public URL (not localhost).";',
    '      return;',
    '    }',
    '    msg.textContent="Preparing your spin link… ("+tries+")";',
    '    setTimeout(tick,700);',
    '  })',
    '  .withFailureHandler(function(e){',
    '    if(tries>=maxTries){err.style.display="block";err.textContent=String(e);return;}',
    '    setTimeout(tick,700);',
    '  })',
    '  .pollSpinUrl();',
    '}',
    'tick();',
    '</script></body></html>',
  ].join('\n');
}
