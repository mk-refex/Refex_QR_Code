/**
 * Refex Winter Campaign — Google Form onFormSubmit
 *
 * Setup
 * 1. Open the Form → ⋮ → Script editor → paste this file.
 * 2. Project Settings → Script properties → add:
 *      WINTER_SPIN_API_KEY   = (same as server WINTER_SPIN_API_KEY)
 *      WINTER_SPIN_ISSUE_URL = https://YOUR-API-HOST/api/winter-spin/issue
 *      SHEET_ID              = 1n4tXtFYlnVJwxtntX5Bew4mKiwabYLOaxTsZ6zvCfpM
 *      SPIN_TAB_NAME         = SpinAllow
 *      ADMIN_EMAIL           = (optional) you@company.com  — failure alerts
 * 3. In the linked Sheet, create tab "SpinAllow" with header row:
 *      Timestamp | Name | Phone | Token | Status | Prize | SpinUrl | Email | PrizeCode
 * 4. Form settings → Collect email addresses = ON (for MailApp).
 * 5. Triggers → Add trigger:
 *      Function: onFormSubmit
 *      Event source: From form
 *      Event type: On form submit
 *
 * Field titles must match the Form questions exactly:
 *   Name | Phone Number | (optional) Email Address
 */

var FORM_FIELDS = {
  name: ['Name', 'name', 'Full Name', 'full_name'],
  phone: ['Phone Number', 'Phone', 'phone', 'Mobile', 'mobile_number'],
  email: ['Email Address', 'Email', 'email'],
};

function onFormSubmit(e) {
  try {
    if (!e || !e.namedValues) {
      throw new Error('Missing form event namedValues. Use an installable On form submit trigger.');
    }

    var props = PropertiesService.getScriptProperties();
    var apiKey = props.getProperty('WINTER_SPIN_API_KEY');
    var issueUrl = props.getProperty('WINTER_SPIN_ISSUE_URL');
    var sheetId = props.getProperty('SHEET_ID');
    var tabName = props.getProperty('SPIN_TAB_NAME') || 'SpinAllow';
    var adminEmail = props.getProperty('ADMIN_EMAIL') || '';

    if (!apiKey || !issueUrl) {
      throw new Error('Set Script properties WINTER_SPIN_API_KEY and WINTER_SPIN_ISSUE_URL.');
    }
    if (!sheetId) {
      throw new Error('Set Script property SHEET_ID.');
    }

    var name = firstValue(e.namedValues, FORM_FIELDS.name);
    var phoneRaw = firstValue(e.namedValues, FORM_FIELDS.phone);
    var email =
      firstValue(e.namedValues, FORM_FIELDS.email) ||
      (e.response && e.response.getRespondentEmail && e.response.getRespondentEmail()) ||
      '';

    name = String(name || '').trim().replace(/\s+/g, ' ');
    var phone = normalizePhone(phoneRaw);

    if (name.length < 2) {
      throw new Error('Name is missing or too short.');
    }
    if (!/^\d{10}$/.test(phone)) {
      throw new Error('Phone must be a valid 10-digit number. Got: ' + phoneRaw);
    }

    var issued = issueSpinToken_(issueUrl, apiKey, name, phone);
    var token = issued.token;
    var spinUrl = issued.spinUrl;

    if (!token || !spinUrl) {
      throw new Error('Issue API returned no token/spinUrl: ' + JSON.stringify(issued));
    }

    appendSpinRow_(sheetId, tabName, {
      timestamp: new Date(),
      name: name,
      phone: phone,
      token: token,
      status: 'pending',
      prize: '',
      spinUrl: spinUrl,
      email: email,
      prizeCode: '',
    });

    if (email) {
      sendSpinEmail_(email, name, spinUrl);
    } else {
      Logger.log('No respondent email — spinUrl stored in Sheet only: ' + spinUrl);
    }
  } catch (err) {
    Logger.log('onFormSubmit error: ' + err);
    notifyAdmin_(err);
    throw err;
  }
}

/** Call Express POST /api/winter-spin/issue */
function issueSpinToken_(issueUrl, apiKey, name, phone) {
  var res = UrlFetchApp.fetch(issueUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-API-Key': apiKey,
    },
    payload: JSON.stringify({
      name: name,
      phone: phone,
    }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  var body;
  try {
    body = JSON.parse(text);
  } catch (parseErr) {
    throw new Error('Issue API non-JSON (' + code + '): ' + text);
  }

  if (code < 200 || code >= 300 || !body.status) {
    throw new Error(
      'Issue API failed (' + code + '): ' + (body.message || text)
    );
  }

  var results = body.results || {};
  return {
    token: results.token,
    spinUrl: results.spinUrl,
    expiresAt: results.expiresAt,
    reused: results.reused,
  };
}

function appendSpinRow_(sheetId, tabName, row) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Phone',
      'Token',
      'Status',
      'Prize',
      'SpinUrl',
      'Email',
      'PrizeCode',
    ]);
  }

  // Ensure header exists on empty sheet
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Phone',
      'Token',
      'Status',
      'Prize',
      'SpinUrl',
      'Email',
      'PrizeCode',
    ]);
  }

  sheet.appendRow([
    row.timestamp,
    row.name,
    row.phone,
    row.token,
    row.status,
    row.prize,
    row.spinUrl,
    row.email,
    row.prizeCode,
  ]);
}

function sendSpinEmail_(to, name, spinUrl) {
  var subject = 'Your Refex Winter Campaign Spin Link';
  var body =
    'Hi ' +
    name +
    ',\n\n' +
    'Thanks for entering the Refex Winter Campaign.\n\n' +
    'Open your personal spin link (one spin only — do not share):\n\n' +
    spinUrl +
    '\n\n' +
    'If the page says Access denied, reply to this email with your phone number.\n' +
    'This link may expire after 72 hours.\n\n' +
    '— Refex Team';

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
  });
}

function normalizePhone(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.charAt(0) === '0') {
    return digits.slice(1);
  }
  return digits;
}

function firstValue(namedValues, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (namedValues[key] && namedValues[key][0] != null && String(namedValues[key][0]).trim() !== '') {
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

/**
 * Manual test from the script editor (Run → testIssueOnly).
 * Does not write Sheet / send email unless you uncomment.
 */
function testIssueOnly() {
  var props = PropertiesService.getScriptProperties();
  var issued = issueSpinToken_(
    props.getProperty('WINTER_SPIN_ISSUE_URL'),
    props.getProperty('WINTER_SPIN_API_KEY'),
    'Test User',
    '9876543210'
  );
  Logger.log(JSON.stringify(issued, null, 2));
}
