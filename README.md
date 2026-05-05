# SAREGO — Southern Africa Regional Economic Growth Office

A full-stack scaffold for a cross-border trade, investment, and project pipeline platform serving SADC and broader Africa.

> **What this is:** a working foundation — not a finished product. It runs locally, the design language is set, the data model is real, and the core APIs work end-to-end.
>
> **What this is not (yet):** S3-backed deal-room file uploads, real-time messaging, the admin moderation UI, or KYC document upload flow. Those are the next iterations.

---

## What's in the box

```
sarego/
├── docs/
│   ├── ARCHITECTURE.md     # System architecture, modules, security posture
│   └── API.md              # API reference
├── backend/                # Node.js + Express + Postgres
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql  # ← Run this against an empty Postgres DB
│   │   │   └── index.js
│   │   ├── middleware/     # auth, error handling
│   │   ├── routes/         # auth, projects, investor, admin, reference
│   │   ├── utils/auth.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
└── frontend/               # React + Vite
    ├── src/
    │   ├── components/     # Brand, Header, Footer, AfricaMap
    │   ├── lib/api.js      # Fetch wrapper with auto-refresh
    │   ├── pages/
    │   │   ├── LandingPage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── InvestorDashboard.jsx
    │   │   └── ProjectDetailPage.jsx
    │   ├── styles/global.css
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Running it locally

### 1. Database

You need PostgreSQL 13+ running locally (or anywhere reachable).

```bash
createdb sarego
psql -d sarego -f backend/src/db/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set DATABASE_URL + generate JWT secrets
# Generate a secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

npm install
npm run dev
```
Backend runs on `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` and proxies `/api/*` to the backend.

---

## Try the flow

1. Visit `http://localhost:5173` — the landing page.
2. Click **Request Access** — register a new account (any role).
3. Sign in — you land on the dashboard.
4. To exercise project features, you can either insert a sample project via SQL or build the project-creation form (deferred).

To promote your account to `verified` for testing:
```sql
UPDATE users SET trust_tier = 'verified' WHERE email = 'you@example.com';
```

To create an admin:
```sql
UPDATE users SET role = 'admin', trust_tier = 'institutional' WHERE email = 'you@example.com';
```

---

## Design system

- **Palette:** Ink black `#0b0d10` · Antique gold `#b08a3a` · Warm ivory `#faf6ee`
- **Typography:** Cormorant Garamond (display) · Inter Tight (body) · JetBrains Mono (figures)
- **Motion:** Staggered `fade-up` reveals, hover-translate cards, gold-rule dividers
- **Spatial:** Editorial layout with generous negative space, asymmetric grids on landing

---

## Roadmap (next iterations)

1. **KYC document upload** — file uploader on the dashboard, S3 pre-signed URLs, admin queue UI
2. ~~**Project creation flow**~~ — ✅ done. Multi-section form at `/projects/new` with draft-save and submit-for-review.
3. **Deal rooms** — full file-share with audit log, time-bound pre-signed download URLs
4. **Real-time messaging** — Socket.io for conversations between counterparties
5. **Admin panel UI** — verification queue, project moderation, audit log viewer
6. **Matchmaking refinement** — tag-similarity scoring on investor mandates
7. **i18n** — EN / FR / PT for SADC + broader Africa reach
8. **Real Africa map** — swap the stylized SVG for proper TopoJSON-based rendering with country click-throughs

See `docs/ARCHITECTURE.md` for the full system design.
