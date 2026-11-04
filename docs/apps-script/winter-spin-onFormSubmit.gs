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
 * Web App poll — always: Form → SpinAllow → Issue → redirect
 */
function pollSpinUrl() {
  try {
    var cached = CacheService.getScriptCache().get('latest_spin_url');
    if (cached) {
      return { ok: true, ready: true, spinUrl: cached, phase: 'cache' };
    }

    var data = readLatestFromForm_();
    if (!data) {
      data = readLatestFromResponsesSheet_();
    }

    if (!data || !data.name || !data.phone) {
      return {
        ok: true,
        ready: false,
        phase: 'empty',
        message: buildEmptyHelp_(),
      };
    }

    var result = completeEntry_(data.name, data.phone, data.email || '');
    return {
      ok: true,
      ready: true,
      spinUrl: result.spinUrl,
      phase: 'done',
    };
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
  email = String(email || '').trim().toLowerCase();

  if (name.length < 2) throw new Error('Name is missing.');
  if (!/^\d{10}$/.test(phone)) throw new Error('Phone must be 10 digits. Got: ' + phone);

  var existing = findByPhone_(phone);
  if (existing && existing.spinUrl) {
    remember_(existing.spinUrl, phone, email || existing.email);
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
    sh.getRange(rowNumber, COL.Status).setValue('processing');
    if (email) sh.getRange(rowNumber, COL.Email).setValue(email);
    SpreadsheetApp.flush();
  } else {
    // FIRST: store in SpinAllow
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

  // THEN: issue token
  var issued = callIssueApi_(name, phone);
  remember_(issued.spinUrl, phone, email);

  // Update SAME record
  updateSpinRow_(rowNumber, {
    token: issued.token,
    status: 'pending',
    spinUrl: issued.spinUrl,
    prize: '',
  });

  return { spinUrl: issued.spinUrl, token: issued.token, rowNumber: rowNumber };
}

// ----------------------------------------------------------------------
// Read answers from the FORM (best source for form-bound script)
// ----------------------------------------------------------------------

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

  // Prefer a response from the last 30 minutes; else absolute latest
  var cutoff = Date.now() - 30 * 60 * 1000;
  var chosen = responses[responses.length - 1];
  for (var i = responses.length - 1; i >= 0; i--) {
    if (responses[i].getTimestamp().getTime() >= cutoff) {
      chosen = responses[i];
      break;
    }
  }

  return answersFromResponse_(chosen);
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
  if (last < 2) return null;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var row = sheet.getRange(last, 1, last, lastCol).getValues()[0];
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

function remember_(spinUrl, phone, email) {
  var c = CacheService.getScriptCache();
  c.put('latest_spin_url', spinUrl, CACHE_TTL);
  c.put('latest_spin_phone', phone || '', CACHE_TTL);
  if (email) c.put('spin_url_email_' + email, spinUrl, CACHE_TTL);
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
    var key = PropertiesService.getScriptProperties().getProperty('WINTER_SPIN_API_KEY') || '';
    if (!key || String(body.apiKey || '') !== key) {
      return json_({ ok: false, message: 'Unauthorized' });
    }

    var phone = normalizePhone(body.phone || '');
    var token = String(body.token || '').trim();
    if (!phone && !token) return json_({ ok: false, message: 'phone or token required' });

    var sheet = getSpinSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return json_({ ok: false, message: 'No rows' });

    var values = sheet.getRange(2, 1, last, HEADERS.length).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var rowPhone = normalizePhone(values[i][2]);
      var rowToken = String(values[i][3] || '').trim();
      if ((phone && rowPhone === phone) || (token && rowToken === token)) {
        var rowNumber = i + 2;
        updateSpinRow_(rowNumber, {
          status: body.status || 'spun',
          prize: body.prize || body.prizeLabel || '',
          prizeCode: body.prizeCode || '',
        });
        return json_({ ok: true, row: rowNumber, message: 'Gift updated' });
      }
    }
    return json_({ ok: false, message: 'Row not found' });
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
  if (fields.token != null) sheet.getRange(rowNumber, COL.Token).setValue(fields.token);
  if (fields.status != null) sheet.getRange(rowNumber, COL.Status).setValue(fields.status);
  if (fields.prize != null) sheet.getRange(rowNumber, COL.Prize).setValue(fields.prize);
  if (fields.spinUrl != null) sheet.getRange(rowNumber, COL.SpinUrl).setValue(fields.spinUrl);
  if (fields.prizeCode != null) sheet.getRange(rowNumber, COL.PrizeCode).setValue(fields.prizeCode);
  SpreadsheetApp.flush();
}

function findByPhone_(phone) {
  phone = normalizePhone(phone);
  var sheet = getSpinSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, 1, last, HEADERS.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (normalizePhone(values[i][2]) !== phone) continue;
    return {
      rowNumber: i + 2,
      name: values[i][1],
      phone: phone,
      token: String(values[i][3] || '').trim(),
      spinUrl: String(values[i][6] || '').trim(),
      email: String(values[i][7] || '').trim().toLowerCase(),
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
    '<p id="m">Saving to SpinAllow & opening spin…</p><p class="e" id="e"></p></div>',
    '<script>',
    'var t=0,M=15,m=document.getElementById("m"),e=document.getElementById("e"),sp=document.getElementById("sp");',
    'function go(u){try{window.top.location.href=u}catch(x){try{location.replace(u)}catch(y){var w=open(u,"_blank");if(!w){e.style.display="block";e.textContent=u}}}}',
    'function fail(x){sp.style.display="none";m.textContent="Could not continue";e.style.display="block";e.textContent=x}',
    'function tick(){t++;google.script.run.withSuccessHandler(function(r){',
    ' if(r&&r.ready&&r.spinUrl){m.textContent="Opening…";go(r.spinUrl);return}',
    ' if(r&&r.phase==="error"){fail(r.message||"Error");return}',
    ' if(r&&r.ok===false&&r.message){fail(r.message);return}',
    ' if(t>=M){fail((r&&r.message)||"Timed out");return}',
    ' m.textContent=(r&&r.message)||("Working… "+t);setTimeout(tick,700)',
    '}).withFailureHandler(function(err){if(t>=M)fail(String(err));else setTimeout(tick,700)}).pollSpinUrl()}',
    'tick();',
    '</script></body></html>',
  ].join('');
}
