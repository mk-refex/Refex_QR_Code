# Refex Winter Campaign — Spin the Wheel

Public contest form and spin wheel for the **Refex Winter Campaign**. The customer fills our form (name, email, phone, bill upload, consent). The server stores the entry, saves the bill files, issues a one-time token, and opens the wheel. One email and one phone can register once. One phone can spin once. The prize is stored in `winter_spin_entries`.

Random or guessed `token` values are **rejected**.

---

## Public URLs

| Environment | URL |
|-------------|-----|
| Form (local) | `http://localhost:3030/winter-campaign` |
| Form (airport path) | `/airport/winter_campaign` |
| Spin (after submit) | `/winter-spin` |

### Query parameters

| Param | Required | Notes |
|-------|----------|--------|
| `name` | Yes | Must match the name registered with the token |
| `phone` | Yes | 10-digit mobile; must match the token (`91…` / `0…` normalized) |
| `token` | **Yes** | Cryptographic token from `/api/winter-spin/issue`. Random strings → Access denied |

**Example (after issue)**

```
https://YOUR-DOMAIN/winter-spin
```

---

## How it works

1. Customer opens `/winter-campaign` and submits name, email, phone, consent, and 1–5 bill files (10 MB each).
2. `POST /api/winter-campaign/register` stores `winter_campaign_submissions` and files under `server/uploads/winter-campaign/`.
3. The server mints a token in `winter_spin_tokens` and stores it in an HttpOnly cookie. The browser opens `/winter-spin` with no name, phone, or token in the address bar.
4. The browser opens `/winter-spin`. Status and spin require that token plus the same name and phone.
5. The prize is saved on `winter_spin_entries`. The same email or phone cannot register again; the same phone cannot spin again.

A random `token` returns the 404 page.

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

### `GET /api/winter-spin/status`

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
| `WINTER_SPIN_API_KEY` | _(empty)_ | Only for trusted server-to-server `/issue` calls. The public form does not use it. |
| `WINTER_SPIN_PUBLIC_BASE_URL` | `CLIENT_URL` or `http://localhost:3030` | Base used when building `spinUrl` |
| `WINTER_SPIN_TOKEN_TTL_HOURS` | `72` | How long an issued link stays valid |
| `WINTER_SPIN_START_DATE` | `2026-11-01` | Campaign start (IST date `YYYY-MM-DD`) |
| `WINTER_SPIN_END_DATE` | `2027-01-15` | Campaign end (Pongal window) |
| `WINTER_SPIN_BETTER_LUCK_PCT` | `88` | % of spins forced to Better Luck |
| `WINTER_SPIN_EST_SPINS_PER_DAY` | `50` | Used only for cash prize day-pacing |

---

## Deploy checklist

1. Deploy updated **client** and **server**.
2. Restart the server so Sequelize creates the campaign tables.
3. Set `WINTER_SPIN_PUBLIC_BASE_URL` to the public site origin.
4. Test:
   - Open `/winter-campaign`, submit once, land on the wheel
   - Same email or phone again → existing spin, no second entry
   - Opening `/winter-spin` without the session cookie → 404
   - Prize is stored in `winter_spin_entries`

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
