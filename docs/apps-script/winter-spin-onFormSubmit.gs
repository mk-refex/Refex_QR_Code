/**
 * Refex Winter Campaign — Form-bound Apps Script
 *
 * Must be pasted in: Google Form → ⋮ → Script editor (NOT a standalone script).
 *
 * On Web App click (thank-you link):
 *  1) Read LATEST answer from the Form itself (FormApp) — reliable
 *  2) Write row to SpinAllow FIRST
 *  3) Call Issue API
 *  4) Update SAME SpinAllow row (Token + SpinUrl)
 *  5) Redirect to spinUrl
 *
 * Script properties
 *   WINTER_SPIN_API_KEY      = same as server .env
 *   WINTER_SPIN_ISSUE_URL     = https://PUBLIC-API/api/winter-spin/issue
 *   SHEET_ID                  = spreadsheet for SpinAllow
 *   SPIN_TAB_NAME             = SpinAllow
 *   FORM_RESPONSES_TAB        = optional fallback tab name
 *   ADMIN_EMAIL               = optional
 *
 * Deploy: Web app → Execute as: Me → Who has access: Anyone
 * Paste Web App URL into Form confirmation / thank-you message.
 *
 * Trigger (backup): onFormSubmit → From form → On form submit
 */

var NAME_KEYS = ['Name', 'name', 'Full Name', 'full_name'];
var PHONE_KEYS = ['Phone Number', 'Phone', 'phone', 'Mobile', 'mobile_number', 'Mobile Number'];
var EMAIL_KEYS = ['Email Address', 'Email', 'email'];

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

var CACHE_TTL = 30 * 60;

// ----------------------------------------------------------------------
function onFormSubmit(e) {
  try {
    var data = parseSubmitEvent_(e) || readLatestFromForm_();
    if (!data) throw new Error('No form answers found in onFormSubmit.');
    completeEntry_(data.name, data.phone, data.email);
  } catch (err) {
    Logger.log('onFormSubmit: ' + err);
    notifyAdmin_(err);
    throw err;
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};

  // Server prize write-back (GET avoids Apps Script POST redirect issues)
  // ?action=updatePrize&apiKey=...&phone=...&prize=...&prizeCode=...&status=spun
  if (String(p.action || '') === 'updatePrize') {
    return handleUpdatePrize_(p);
  }

  return HtmlService.createHtmlOutput(waitingHtml_())
    .setTitle('Opening Winter Spin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Web App poll — find THIS person by email (not the latest submit).
 * emailHint: typed email, or blank to use the signed-in Google account.
 */
function pollSpinUrl(emailHint) {
  try {
    var email = normalizeEmail_(emailHint) || sessionEmail_();
    if (!email) {
      return {
        ok: true,
        ready: false,
        phase: 'need_email',
        message: 'Enter the email address you used on the form.',
      };
    }

    var cached = CacheService.getScriptCache().get(emailCacheKey_(email));
    if (cached) {
      return { ok: true, ready: true, spinUrl: cached, phase: 'cache', email: email };
    }

    var existing = findByEmail_(email);
    if (existing && existing.spinUrl) {
      remember_(existing.spinUrl, existing.phone, email);
      return { ok: true, ready: true, spinUrl: existing.spinUrl, phase: 'sheet', email: email };
    }

    var data = findFormResponseByEmail_(email);
    if (!data || !data.name || !data.phone) {
      return {
        ok: true,
        ready: false,
        phase: 'empty',
        message: 'No form submission found for ' + email + '. Submit the form with this email, then try again.',
      };
    }

    var result = completeEntry_(data.name, data.phone, email);
    return { ok: true, ready: true, spinUrl: result.spinUrl, phase: 'done', email: email };
  } catch (err) {
    return {
      ok: false,
      ready: false,
      phase: 'error',
      message: String(err.message || err),
    };
  }
}

/**
 * 1) SpinAllow row first
 * 2) Issue API
 * 3) Update same row with token + spinUrl
 */
function completeEntry_(name, phone, email) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  phone = normalizePhone(phone);
  email = normalizeEmail_(email);

  if (!email) throw new Error('Email is required to match concurrent submissions.');
  if (name.length < 2) throw new Error('Name is missing.');
  if (!/^\d{10}$/.test(phone)) throw new Error('Phone must be 10 digits. Got: ' + phone);

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    // Concurrent-safe: match this person by email first, then phone
    var existing = findByEmail_(email) || findByPhone_(phone);
    if (existing && existing.spinUrl) {
      if (email && !existing.email) {
        updateSpinRow_(existing.rowNumber, { email: email });
      }
      remember_(existing.spinUrl, phone, email);
      return {
        spinUrl: existing.spinUrl,
        token: existing.token,
        rowNumber: existing.rowNumber,
      };
    }

    var rowNumber;
    if (existing) {
      rowNumber = existing.rowNumber;
      var sh = getSpinSheet_();
      sh.getRange(rowNumber, COL.Name).setValue(name);
      sh.getRange(rowNumber, COL.Phone).setValue(phone);
      sh.getRange(rowNumber, COL.Email).setValue(email);
      sh.getRange(rowNumber, COL.Status).setValue('processing');
      SpreadsheetApp.flush();
    } else {
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
    }

    var issued = callIssueApi_(name, phone);
    remember_(issued.spinUrl, phone, email);

    // Do not clear Prize — a finished spin must keep its gift
    updateSpinRow_(rowNumber, {
      token: issued.token,
      status: existing && existing.status === 'spun' ? 'spun' : 'pending',
      spinUrl: issued.spinUrl,
      email: email,
    });

    return { spinUrl: issued.spinUrl, token: issued.token, rowNumber: rowNumber };
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------------
// Read answers from the FORM (best source for form-bound script)
// ----------------------------------------------------------------------

function sessionEmail_() {
  try {
    return normalizeEmail_(Session.getActiveUser().getEmail() || '');
  } catch (e) {
    return '';
  }
}

function findFormResponseByEmail_(email) {
  email = normalizeEmail_(email);
  if (!email) return null;

  var fromForm = findFormAppResponseByEmail_(email);
  if (fromForm) return fromForm;
  return findResponsesSheetByEmail_(email);
}

function findFormAppResponseByEmail_(email) {
  var form;
  try {
    form = FormApp.getActiveForm();
  } catch (e) {
    form = null;
  }
  if (!form) return null;

  var responses = form.getResponses();
  if (!responses || !responses.length) return null;

  for (var i = responses.length - 1; i >= 0; i--) {
    var parsed = answersFromResponse_(responses[i]);
    if (normalizeEmail_(parsed.email) === email) return parsed;
  }
  return null;
}

/** Kept for onFormSubmit fallback only — never used for Web App identity. */
function readLatestFromForm_() {
  var form;
  try {
    form = FormApp.getActiveForm();
  } catch (e) {
    form = null;
  }
  if (!form) return null;
  var responses = form.getResponses();
  if (!responses || !responses.length) return null;
  return answersFromResponse_(responses[responses.length - 1]);
}

function answersFromResponse_(response) {
  var map = {};
  var items = response.getItemResponses();
  for (var i = 0; i < items.length; i++) {
    var title = String(items[i].getItem().getTitle() || '').trim();
    map[title] = items[i].getResponse();
  }

  var email = '';
  try {
    email = response.getRespondentEmail() || '';
  } catch (ignore) {}

  return {
    name: pick_(map, NAME_KEYS),
    phone: pick_(map, PHONE_KEYS),
    email: pick_(map, EMAIL_KEYS) || email,
    timestamp: response.getTimestamp(),
  };
}

function parseSubmitEvent_(e) {
  if (!e) return null;
  if (e.namedValues) {
    return {
      name: firstNamed_(e.namedValues, NAME_KEYS),
      phone: firstNamed_(e.namedValues, PHONE_KEYS),
      email:
        firstNamed_(e.namedValues, EMAIL_KEYS) ||
        (e.response && e.response.getRespondentEmail && e.response.getRespondentEmail()) ||
        '',
    };
  }
  if (e.response) return answersFromResponse_(e.response);
  return null;
}

// Fallback: spreadsheet tab
function readLatestFromResponsesSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) return null;

  var ss = SpreadsheetApp.openById(sheetId);
  var tabName = props.getProperty('FORM_RESPONSES_TAB') || '';
  var sheet = tabName ? ss.getSheetByName(tabName) : null;

  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (/form.?response/i.test(all[i].getName())) {
        sheet = all[i];
        break;
      }
    }
  }
  if (!sheet) return null;

  var last = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (last < 2 || lastCol < 1) return null;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // getRange(row, col, numRows, numCols) — one row only
  var row = sheet.getRange(last, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headers.length; c++) {
    map[String(headers[c] || '').trim()] = row[c];
  }

  return {
    name: pick_(map, NAME_KEYS),
    phone: pick_(map, PHONE_KEYS),
    email: pick_(map, EMAIL_KEYS),
  };
}

function buildEmptyHelp_() {
  var bits = [];
  bits.push('No form answers found yet.');

  try {
    var form = FormApp.getActiveForm();
    if (!form) {
      bits.push('Script is NOT bound to the Form. Open Form → ⋮ → Script editor and paste there.');
    } else {
      var n = form.getResponses().length;
      bits.push('Form "' + form.getTitle() + '" has ' + n + ' response(s).');
      if (n === 0) bits.push('Submit the form once, then open this link again.');
    }
  } catch (e) {
    bits.push('FormApp error: ' + e);
  }

  try {
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('SHEET_ID');
    if (sheetId) {
      var ss = SpreadsheetApp.openById(sheetId);
      bits.push(
        'Sheet tabs: ' +
          ss
            .getSheets()
            .map(function (s) {
              return s.getName();
            })
            .join(' | ')
      );
    } else {
      bits.push('SHEET_ID script property is missing.');
    }
  } catch (e2) {
    bits.push('Sheet error: ' + e2);
  }

  return bits.join(' ');
}

// ----------------------------------------------------------------------
// Issue API
// ----------------------------------------------------------------------

function callIssueApi_(name, phone) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty('WINTER_SPIN_API_KEY') || '').trim();
  var issueUrl = String(props.getProperty('WINTER_SPIN_ISSUE_URL') || '').trim();
  if (!apiKey || !issueUrl) throw new Error('Set WINTER_SPIN_API_KEY and WINTER_SPIN_ISSUE_URL.');
  if (/localhost|127\.0\.0\.1/i.test(issueUrl)) {
    throw new Error('Issue URL cannot be localhost. Use public HTTPS API.');
  }

  // Match Postman: JSON body + API key in several places (CDN may strip some headers)
  var payload = {
    name: name,
    phone: phone,
    apiKey: apiKey,
    api_key: apiKey,
  };

  var res = UrlFetchApp.fetch(issueUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
      'Api-Key': apiKey,
      Authorization: 'Bearer ' + apiKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  var body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    throw new Error('Issue API non-JSON (' + code + '): ' + text.slice(0, 250));
  }
  if (code < 200 || code >= 300 || !body.status) {
    throw new Error(
      'Issue API failed (' +
        code +
        '): ' +
        (body.message || text) +
        ' | keyLen=' +
        apiKey.length +
        ' | url=' +
        issueUrl
    );
  }
  var r = body.results || {};
  if (!r.token || !r.spinUrl) throw new Error('Issue API missing token/spinUrl');
  return { token: r.token, spinUrl: r.spinUrl };
}

/**
 * Run this from the Apps Script editor (Run → testIssueApiFromScript)
 * to verify the key/URL without submitting the Form.
 */
function testIssueApiFromScript() {
  var result = callIssueApi_('Script Test', '9000000001');
  Logger.log(JSON.stringify(result, null, 2));
}

function emailCacheKey_(email) {
  return 'spin_url_email_' + normalizeEmail_(email);
}

function remember_(spinUrl, phone, email) {
  if (!email || !spinUrl) return;
  var c = CacheService.getScriptCache();
  // Per-email only. A shared "latest" key mixes concurrent users.
  c.put(emailCacheKey_(email), spinUrl, CACHE_TTL);
  c.put('spin_phone_email_' + normalizeEmail_(email), phone || '', CACHE_TTL);
}

// ----------------------------------------------------------------------
// Prize / gift update on SAME SpinAllow row (after spin completes)
// ----------------------------------------------------------------------

function doPost(e) {
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || '{}');
    body.action = body.action || 'updatePrize';
    return handleUpdatePrize_(body);
  } catch (err) {
    return json_({ ok: false, message: String(err.message || err) });
  }
}

function handleUpdatePrize_(body) {
  try {
    var key = String(
      PropertiesService.getScriptProperties().getProperty('WINTER_SPIN_API_KEY') || ''
    ).trim();
    var given = String(body.apiKey || '').trim();
    if (!key || given !== key) {
      return json_({
        ok: false,
        message: 'Unauthorized prize update (key length ' + given.length + ').',
      });
    }

    var phone = normalizePhone(body.phone || '');
    var token = String(body.token || '').trim();
    var email = normalizeEmail_(body.email || '');
    if (!phone && !token && !email) {
      return json_({ ok: false, message: 'phone, token, or email required' });
    }

    var sheet = getSpinSheet_();
    var values = readDataRows_(sheet);
    for (var i = values.length - 1; i >= 0; i--) {
      var rowPhone = normalizePhone(values[i][2]);
      var rowToken = String(values[i][3] || '').trim();
      var rowEmail = normalizeEmail_(values[i][7]);
      var match =
        (token && rowToken && rowToken === token) ||
        (email && rowEmail && rowEmail === email) ||
        (phone && rowPhone && rowPhone === phone);
      if (!match) continue;

      var rowNumber = i + 2;
      updateSpinRow_(rowNumber, {
        status: body.status || 'spun',
        prize: body.prize || body.prizeLabel || '',
        prizeCode: body.prizeCode || '',
      });
      return json_({ ok: true, row: rowNumber, message: 'Gift updated' });
    }
    return json_({ ok: false, message: 'Row not found for prize update' });
  } catch (err) {
    return json_({ ok: false, message: String(err.message || err) });
  }
}

// ----------------------------------------------------------------------
// SpinAllow sheet I/O
// ----------------------------------------------------------------------

function getSpinSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  var tab = props.getProperty('SPIN_TAB_NAME') || 'SpinAllow';
  if (!sheetId) throw new Error('Set SHEET_ID script property.');

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(tab);
  if (!sheet) {
    sheet = ss.insertSheet(tab);
    sheet.appendRow(HEADERS);
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

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
  SpreadsheetApp.flush();
  return sheet.getLastRow();
}

function updateSpinRow_(rowNumber, fields) {
  if (!rowNumber || rowNumber < 2) return;
  var sheet = getSpinSheet_();
  if (fields.token != null && fields.token !== '') sheet.getRange(rowNumber, COL.Token).setValue(fields.token);
  if (fields.status != null && fields.status !== '') sheet.getRange(rowNumber, COL.Status).setValue(fields.status);
  if (fields.prize != null && fields.prize !== '') sheet.getRange(rowNumber, COL.Prize).setValue(fields.prize);
  if (fields.spinUrl != null && fields.spinUrl !== '') sheet.getRange(rowNumber, COL.SpinUrl).setValue(fields.spinUrl);
  if (fields.prizeCode != null && fields.prizeCode !== '') {
    sheet.getRange(rowNumber, COL.PrizeCode).setValue(fields.prizeCode);
  }
  if (fields.email != null && fields.email !== '') sheet.getRange(rowNumber, COL.Email).setValue(fields.email);
  SpreadsheetApp.flush();
}

/** Data rows only. getRange 3rd arg is row COUNT, not the last row index. */
function readDataRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

function rowFromValues_(values, i) {
  return {
    rowNumber: i + 2,
    name: values[i][1],
    phone: normalizePhone(values[i][2]),
    token: String(values[i][3] || '').trim(),
    status: String(values[i][4] || '').trim(),
    prize: values[i][5],
    spinUrl: String(values[i][6] || '').trim(),
    email: normalizeEmail_(values[i][7]),
    prizeCode: values[i][8],
  };
}

function findByEmail_(email) {
  email = normalizeEmail_(email);
  if (!email) return null;
  var values = readDataRows_(getSpinSheet_());
  for (var i = values.length - 1; i >= 0; i--) {
    if (normalizeEmail_(values[i][7]) !== email) continue;
    return rowFromValues_(values, i);
  }
  return null;
}

function findByPhone_(phone) {
  phone = normalizePhone(phone);
  if (!phone) return null;
  var values = readDataRows_(getSpinSheet_());
  for (var i = values.length - 1; i >= 0; i--) {
    if (normalizePhone(values[i][2]) !== phone) continue;
    return rowFromValues_(values, i);
  }
  return null;
}

function findResponsesSheetByEmail_(email) {
  email = normalizeEmail_(email);
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId || !email) return null;

  var ss = SpreadsheetApp.openById(sheetId);
  var tabName = props.getProperty('FORM_RESPONSES_TAB') || '';
  var sheet = tabName ? ss.getSheetByName(tabName) : null;
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (/form.?response/i.test(all[i].getName())) {
        sheet = all[i];
        break;
      }
    }
  }
  if (!sheet) return null;

  var last = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (last < 2 || lastCol < 1) return null;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = sheet.getRange(2, 1, last - 1, lastCol).getValues();
  for (var r = rows.length - 1; r >= 0; r--) {
    var map = {};
    for (var c = 0; c < headers.length; c++) {
      map[String(headers[c] || '').trim()] = rows[r][c];
    }
    var rowEmail = normalizeEmail_(pick_(map, EMAIL_KEYS));
    if (rowEmail !== email) continue;
    return {
      name: pick_(map, NAME_KEYS),
      phone: pick_(map, PHONE_KEYS),
      email: rowEmail,
    };
  }
  return null;
}

// ----------------------------------------------------------------------
function normalizePhone(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) return d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') return d.slice(1);
  return d;
}

function normalizeEmail_(raw) {
  return String(raw || '').trim().toLowerCase();
}

function pick_(map, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]] != null && String(map[keys[i]]).trim() !== '') return map[keys[i]];
  }
  var lower = {};
  Object.keys(map).forEach(function (k) {
    lower[String(k).toLowerCase()] = map[k];
  });
  for (var j = 0; j < keys.length; j++) {
    var lk = String(keys[j]).toLowerCase();
    if (lower[lk] != null && String(lower[lk]).trim() !== '') return lower[lk];
  }
  return '';
}

function firstNamed_(namedValues, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (namedValues[k] && namedValues[k][0] != null && String(namedValues[k][0]).trim() !== '') {
      return namedValues[k][0];
    }
  }
  return '';
}

function notifyAdmin_(err) {
  var admin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!admin) return;
  try {
    MailApp.sendEmail(admin, '[Winter Spin] error', String(err && err.stack ? err.stack : err));
  } catch (e) {}
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function waitingHtml_() {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<base target="_top"/><style>',
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;',
    'font-family:Arial,sans-serif;background:#0B2744;color:#fff;padding:24px}',
    'p{max-width:520px;line-height:1.5;opacity:.9}',
    '.s{width:36px;height:36px;margin:0 auto 16px;border-radius:50%;',
    'border:3px solid rgba(255,255,255,.25);border-top-color:#F5B400;animation:r .8s linear infinite}',
    '@keyframes r{to{transform:rotate(360deg)}}',
    '.e{color:#FFB4A8;display:none;margin-top:12px;word-break:break-word}',
    '</style></head><body><div><div class="s" id="sp"></div>',
    '<p id="m">Finding your submission…</p>',
    '<form id="f" style="display:none;max-width:360px;margin:12px auto 0">',
    '<input id="em" type="email" required placeholder="Email used on the form" ',
    'style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:0;margin-bottom:10px"/>',
    '<button type="submit" style="width:100%;padding:12px;border:0;border-radius:10px;font-weight:700;cursor:pointer">Continue</button>',
    '</form><p class="e" id="e"></p></div>',
    '<script>',
    'var t=0,M=12,email="",m=document.getElementById("m"),e=document.getElementById("e"),sp=document.getElementById("sp"),f=document.getElementById("f");',
    'function go(u){try{window.top.location.href=u}catch(x){try{location.replace(u)}catch(y){var w=open(u,"_blank");if(!w){e.style.display="block";e.textContent=u}}}}',
    'function fail(x){sp.style.display="none";m.textContent="Could not continue";e.style.display="block";e.textContent=x}',
    'function askEmail(msg){sp.style.display="none";f.style.display="block";m.textContent=msg||"Enter the email used on the form."}',
    'function tick(){t++;google.script.run.withSuccessHandler(function(r){',
    ' if(r&&r.ready&&r.spinUrl){m.textContent="Opening…";go(r.spinUrl);return}',
    ' if(r&&r.phase==="need_email"){askEmail(r.message);return}',
    ' if(r&&r.phase==="error"){fail(r.message||"Error");return}',
    ' if(r&&r.ok===false&&r.message){fail(r.message);return}',
    ' if(r&&r.phase==="empty"){fail(r.message);return}',
    ' if(t>=M){fail((r&&r.message)||"Timed out");return}',
    ' m.textContent=(r&&r.message)||("Working… "+t);setTimeout(tick,700)',
    '}).withFailureHandler(function(err){if(t>=M)fail(String(err));else setTimeout(tick,700)}).pollSpinUrl(email)}',
    'f.addEventListener("submit",function(ev){ev.preventDefault();email=document.getElementById("em").value;e.style.display="none";f.style.display="none";sp.style.display="block";t=0;m.textContent="Finding your submission…";tick()});',
    'tick();',
    '</script></body></html>',
  ].join('');
}
