# Refex Winter Campaign — Spin the Wheel

Public contest page for the **Refex Winter Campaign**. Contestants open a **server-issued** link (after a Google Form) with their **name**, **phone**, and **token**, spin once, and receive a server-assigned prize.

Random or guessed `token` values are **rejected**. Only tokens created by `POST /api/winter-spin/issue` (protected by `WINTER_SPIN_API_KEY`) work.

---

## Public URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3030/winter-spin?name=...&phone=...&token=...` |
| Alternate path | `/airport/winter_campaign?name=...&phone=...&token=...` |
| Production | `https://YOUR-DOMAIN/winter-spin?name=...&phone=...&token=...` |

### Query parameters

| Param | Required | Notes |
|-------|----------|--------|
| `name` | Yes | Must match the name registered with the token |
| `phone` | Yes | 10-digit mobile; must match the token (`91…` / `0…` normalized) |
| `token` | **Yes** | Cryptographic token from `/api/winter-spin/issue`. Random strings → Access denied |

**Example (after issue)**

```
https://YOUR-DOMAIN/winter-spin?name=Murugesh%20Kumar&phone=9876543210&token=a1b2c3…(64 hex chars)
```

---

## How token protection works

1. Google Form / Apps Script (or your backend) calls **`POST /api/winter-spin/issue`** with an API key + name + phone.
2. Server stores a row in `winter_spin_tokens` and returns `spinUrl` (includes a 64-char hex token).
3. User opens that URL. Status + spin APIs load the token from DB and require **exact match** on token + phone + name.
4. On successful spin, `used_at` is set. Same phone cannot win again.

Without a DB row for that token → **403 Access denied**. Typing random characters in `token=` does not open the wheel.

---

## Google Form / Apps Script setup

1. Collect **Name**, **Phone**, and bill/invoice on the Google Form.
2. On form submit, Apps Script calls the issue API, then redirects (or emails) the returned `spinUrl`.

### Issue API

```
POST /api/winter-spin/issue
Header: X-API-Key: <WINTER_SPIN_API_KEY>
Content-Type: application/json

{ "name": "Murugesh Kumar", "phone": "9876543210" }
```

**Success `results`**

- `token` — hex string
- `expiresAt` — expiry (default 72h, see env)
- `spinUrl` — ready-to-open public link
- `reused` — `true` if an unused non-expired token for that phone was reused

### Apps Script sketch

```javascript
function onFormSubmit(e) {
  const name = e.namedValues['Name'][0];
  const phone = e.namedValues['Phone'][0];
  const API = 'https://YOUR-API-HOST/api/winter-spin/issue';
  const KEY = PropertiesService.getScriptProperties().getProperty('WINTER_SPIN_API_KEY');

  const res = UrlFetchApp.fetch(API, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-API-Key': KEY },
    payload: JSON.stringify({ name, phone }),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  const spinUrl = body.results && body.results.spinUrl;
  // Redirect / email spinUrl to the contestant
}
```

Store `WINTER_SPIN_API_KEY` in Apps Script **Script properties**, never in the form URL.

---

## User experience

1. Page loads with Refex branding and **Refex Winter Campaign** title.
2. Shows name + phone chips from the URL.
3. **Left:** prize wheel + Spin button.  
   **Right:** prize result panel (placeholder until spin finishes).
4. On spin stop: confetti celebration + result card with prize icon/emoji.
5. Same phone opening a valid link again sees the **saved result** (no second prize).

One phone number can win **only one** prize for the campaign (enforced in the database). This rule is **not** shown in the UI.

---

## Prize categories & weekly caps

Week = **Monday–Sunday (Asia/Kolkata)**. Caps reset automatically each Monday until campaign end (Pongal).

| Prize | Code | Weekly cap |
|-------|------|------------|
| Better Luck Next Time | `better_luck` | Unlimited |
| Win up to ₹2,000 | `win_2000` | **2** / week |
| Win up to ₹5,000 | `win_5000` | **2** / week |
| Win up to ₹7,000 | `win_7000` | **1** / week |
| Win up to ₹10,000 | `win_10000` | **1** / week |
| Bumper Prize Lucky Draw | `bumper` | Unlimited (eligible for draw) |

When a capped category is exhausted for the week, it is no longer awarded until the next Monday.

### Allocation logic (secure)

- Prize is chosen **only on the server** (`crypto.randomInt`). The wheel only animates to that result.
- **~88%** of spins go to **Better Luck Next Time** first (configurable).
- Remaining spins enter a small lottery (mostly bumper; cash is rare).
- Cash prizes are **paced** so remaining weekly slots can fall on **any day**, not all early in the week.
- Inventory is stored in `winter_spin_weekly_stock` and updated atomically (`used < cap`).

---

## APIs

Base path: `/api`

### `GET /api/winter-spin/status?name=...&phone=...&token=...`

Validates the issued token, then returns campaign status / prior spin.

**Success `results` (summary)**

- `campaignActive`, `campaignEnd`, `weekKey`
- `alreadySpun`, `entry` (if any)
- `segments` (prize codes/labels for UI)

**403** if token is missing, unknown, expired, or does not match name/phone.

### `POST /api/winter-spin/issue`

See [Issue API](#issue-api) above. Requires `WINTER_SPIN_API_KEY`.

### `POST /api/winter-spin/spin`

**Body**

```json
{
  "name": "Murugesh Kumar",
  "phone": "9876543210",
  "token": "<issued-hex-token>"
}
```

**Success `results`**

- `alreadySpun` — `true` if this phone already had a result
- `weekKey`
- `entry` — `{ name, phone, token, prizeCode, prizeLabel, isWin, weekKey, spunAt }`

Marks the token as used when a new prize is assigned.

---

## Database tables

Created via Sequelize `sync()` on server start:

| Table | Purpose |
|-------|---------|
| `winter_spin_tokens` | Issued tokens (token, name, phone, expires_at, used_at) |
| `winter_spin_entries` | One row per phone (unique). Stores prize won + token used |
| `winter_spin_weekly_stock` | Per-week cap + used count for cash prizes |

---

## Key source files

| Area | Path |
|------|------|
| Page | `client/src/pages/winter-spin.jsx` |
| UI | `client/src/sections/winter-spin/` |
| Routes | `client/src/routes/sections.jsx` → `/winter-spin`, `/airport/winter_campaign` |
| Service / logic | `server/src/services/winterSpinService.js` |
| API | `server/src/routes/contest/winterSpin.js` |
| Models | `server/src/models/contest/winter_spin_*.js` |

---

## Environment variables

Set on the **server**:

| Variable | Default | Meaning |
|----------|---------|---------|
| `WINTER_SPIN_API_KEY` | _(empty)_ | **Required** to issue tokens. Shared secret for Apps Script |
| `WINTER_SPIN_PUBLIC_BASE_URL` | `CLIENT_URL` or `http://localhost:3030` | Base used when building `spinUrl` |
| `WINTER_SPIN_TOKEN_TTL_HOURS` | `72` | How long an issued link stays valid |
| `WINTER_SPIN_START_DATE` | `2026-11-01` | Campaign start (IST date `YYYY-MM-DD`) |
| `WINTER_SPIN_END_DATE` | `2027-01-15` | Campaign end (Pongal window) |
| `WINTER_SPIN_BETTER_LUCK_PCT` | `88` | % of spins forced to Better Luck |
| `WINTER_SPIN_EST_SPINS_PER_DAY` | `50` | Used only for cash prize day-pacing |

---

## Deploy checklist

1. Set `WINTER_SPIN_API_KEY` (long random string) and `WINTER_SPIN_PUBLIC_BASE_URL` on the server.
2. Deploy updated **client** and **server**.
3. Restart the server so Sequelize creates `winter_spin_tokens`.
4. Point Google Form Apps Script at `/api/winter-spin/issue` with the same API key.
5. Test:
   - Issue token → open `spinUrl` → spin → result + confetti  
   - Same phone again → previous result  
   - Random `token=` → Access denied  
   - Missing `name`/`phone`/`token` → Access denied  

---

## Local test

```bash
# Client (e.g. port 3030)
cd client && npm run dev

# Server — set key first, then run
# PowerShell: $env:WINTER_SPIN_API_KEY="dev-secret-change-me"
cd server && npm run dev
```

Issue a token:

```bash
curl -X POST http://localhost:3001/api/winter-spin/issue ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: dev-secret-change-me" ^
  -d "{\"name\":\"Test User\",\"phone\":\"9876543210\"}"
```

Open the returned `spinUrl`. A made-up token in the URL will show Access denied.
