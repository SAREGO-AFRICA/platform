# SAREGO — Architecture Overview

**Southern Africa Regional Economic Growth Office**
A cross-border trade, investment, and project pipeline platform for SADC and broader Africa.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  React SPA (Vite) — Public site, role dashboards, deal rooms    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / JWT
┌──────────────────────────▼──────────────────────────────────────┐
│                      API GATEWAY (Express)                      │
│   Rate limiting · CORS · Helmet · Request validation (Zod)      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────────┐
        ▼                  ▼                          ▼
┌──────────────┐  ┌──────────────────┐   ┌────────────────────┐
│ Auth Service │  │ Domain Services  │   │  Admin Service     │
│ JWT · KYC    │  │ Projects · Deals │   │  Verification ·    │
│ Sessions     │  │ Matchmaking · Msg│   │  Moderation · Logs │
└──────┬───────┘  └────────┬─────────┘   └─────────┬──────────┘
       │                   │                       │
       └─────────────┬─────┴─────────────────┬─────┘
                     ▼                       ▼
            ┌────────────────┐      ┌──────────────────┐
            │   PostgreSQL   │      │  Object Storage  │
            │ (RLS-friendly) │      │ (S3 / R2 — docs) │
            └────────────────┘      └──────────────────┘
```

## 2. User Roles & Capabilities

| Role               | Primary capabilities                                                |
| ------------------ | ------------------------------------------------------------------- |
| **Government**     | Publish national projects, set investment priorities, vet investors |
| **Investor (DFI / PE / Family Office)** | Browse pipeline, express interest, request deal rooms, matchmaking |
| **Corporate**      | List trade opportunities, partner with SMEs, post procurement RFPs  |
| **SME**            | Apply for trade facilitation, access investor introductions         |
| **Project Developer** | List bankable projects, manage data rooms, track investor interest |
| **Admin / SAREGO Staff** | Verify KYC, moderate listings, manage taxonomies, view analytics |

## 3. Trust Layer (KYC-Style)

Every account starts at trust tier `unverified` and progresses:

- **unverified** → email-confirmed only, can browse
- **basic** → identity documents uploaded, in review
- **verified** → manual SAREGO review passed, full marketplace access
- **institutional** → enhanced due diligence for governments / DFIs / large investors

A `verification_documents` table holds uploaded artifacts; a SAREGO admin transitions tiers via the admin panel. All verification actions are audit-logged.

## 4. Core Modules

1. **Investment marketplace** — `projects`, `project_sectors`, `project_documents`
2. **Trade facilitation hub** — `trade_opportunities`, `trade_categories`
3. **Government interface** — government accounts can publish `national_priorities`
4. **Project pipeline** — stage tracking on each project (`origination → preparation → bankable → financing → execution`)
5. **Deal rooms** — gated access spaces with permissioned document sharing
6. **Matchmaking engine** — rules-based + tag-similarity scoring across investor mandates ↔ project profiles
7. **Messaging & introductions** — threaded conversations gated by KYC tier
8. **Admin control panel** — verification queue, listing moderation, taxonomy management

## 5. Tech Stack

- **Frontend**: React 18 + Vite, React Router, Tailwind-ish custom CSS, Lucide icons
- **Backend**: Node.js + Express, Zod validation, bcrypt, jsonwebtoken
- **Database**: PostgreSQL 15+, with `pgcrypto` for UUIDs
- **Auth**: JWT access tokens (15 min) + refresh tokens (7 days, httpOnly cookies)
- **Storage**: S3-compatible (R2 / S3 / MinIO) for deal-room documents — never on filesystem
- **Email**: transactional provider (Postmark / SES) for verification & deal-room invites
- **Observability**: structured logs (pino), request IDs, audit log table

## 6. Security Posture

- All passwords hashed with bcrypt (cost 12)
- JWT signed with rotating secret stored in env, never in code
- Refresh tokens stored hashed in DB, revocable
- Deal-room access uses signed pre-signed URLs with short TTLs for documents
- Audit log on every privileged action: KYC tier change, deal-room access grant, admin override
- Row-level filtering enforced at service layer; DB schema designed so RLS can be added later
- Rate limits on auth endpoints (5 req / 15 min / IP) and messaging
- HTTPS only in production; HSTS, secure cookies, SameSite=Lax

## 7. Deployment Topology (suggested)

- Frontend → Vercel / Cloudflare Pages
- Backend → Render / Fly.io / AWS ECS (multi-AZ)
- DB → managed Postgres (Neon / RDS / Supabase) with PITR backups
- Object storage → Cloudflare R2 or AWS S3 with bucket-level encryption
- CDN in front of public assets and the SPA

## 8. What's in this scaffold

This first delivery includes:
- Complete PostgreSQL schema (`backend/src/db/schema.sql`) with seed data
- Express backend with JWT auth, projects API, profiles API, deal-room scaffold
- React frontend: landing page (premium institutional aesthetic) + investor dashboard
- Documented API surface (`docs/API.md`)

Next iterations should add: matchmaking scoring, full deal-room file flow with S3 pre-signed URLs, admin verification queue UI, real-time messaging (Socket.io), audit log viewer, and i18n (EN / FR / PT for SADC + ECOWAS reach).
