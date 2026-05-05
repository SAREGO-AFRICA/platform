# SAREGO API — v0.1

Base URL: `http://localhost:4000` (development)

All authenticated endpoints expect:
```
Authorization: Bearer <access_token>
```
The refresh token is stored in an httpOnly cookie named `sarego_refresh`.

---

## Auth

### `POST /api/auth/register`
Create a new account.
```json
{
  "email": "kwame@example.com",
  "password": "at-least-10-chars",
  "full_name": "Kwame Mensah",
  "role": "investor",
  "organization_name": "Pan-African Capital Partners",
  "country_iso": "ZA"
}
```

### `POST /api/auth/login`
```json
{ "email": "kwame@example.com", "password": "..." }
```
Returns `{ access_token, user }` and sets the `sarego_refresh` cookie.

### `POST /api/auth/refresh`
Uses the refresh cookie to issue a new access token. Rotates the refresh token.

### `POST /api/auth/logout`
Revokes the current refresh token.

### `GET /api/auth/me`  *(auth required)*

---

## Reference data

### `GET /api/reference/countries`
### `GET /api/reference/sectors`

---

## Projects

### `GET /api/projects?country=ZA&sector=energy&stage=bankable&limit=20&offset=0`
Public, paginated list of published projects.

### `GET /api/projects/:slug`
Public detail view.

### `POST /api/projects` *(auth, role: project_developer / government / corporate, tier ≥ basic)*
```json
{
  "title": "Beira–Tete Solar Corridor",
  "summary": "120 MW utility-scale solar PV anchored on a 20-year PPA with EDM ...",
  "country_iso": "MZ",
  "location_text": "Manica Province",
  "capital_required_usd": 180000000,
  "expected_irr_pct": 14.5,
  "stage": "preparation",
  "sector_slugs": ["renewables", "energy", "infrastructure"]
}
```

### `POST /api/projects/:id/publish`
Owner submits for review (status → `pending_review`). Admin can publish directly (status → `published`).

### `GET /api/projects/:id/edit` *(auth, owner or admin)*
Returns the full project including draft state and selected sectors. Used by the project edit form.

### `PUT /api/projects/:id` *(auth, owner of draft/rejected project, or admin)*
```json
{
  "title": "Beira–Tete Solar Corridor",
  "summary": "120 MW utility-scale solar PV ...",
  "country_iso": "MZ",
  "capital_required_usd": 180000000,
  "expected_irr_pct": 14.5,
  "stage": "preparation",
  "sector_slugs": ["renewables", "energy"]
}
```
Owners can edit only `draft` and `rejected` projects. Admins can edit any.

### `POST /api/projects/:id/interest` *(auth, role: investor, tier ≥ verified)*
```json
{ "ticket_usd": 25000000, "message": "Aligned with our renewables mandate." }
```

### `GET /api/projects/mine/list` *(auth)*
Projects owned by the current user.

---

## Investor

### `GET /api/investor/mandate` *(auth, role: investor)*
### `PUT /api/investor/mandate` *(auth, role: investor)*
```json
{
  "investor_type": "private_equity",
  "ticket_size_min_usd": 5000000,
  "ticket_size_max_usd": 50000000,
  "aum_usd": 1200000000,
  "thesis": "Infrastructure and energy transition across SADC.",
  "sector_slugs": ["renewables", "infrastructure", "logistics"],
  "country_isos": ["ZA", "MZ", "ZM", "BW"]
}
```

### `GET /api/investor/matches?limit=20`
Rules-based match feed scored by sector overlap, country alignment, and ticket-size fit.

---

## Admin

All admin routes require `role: admin`.

### `GET /api/admin/verification-queue`
### `POST /api/admin/verification/:docId`
```json
{ "decision": "approve", "promote_to_tier": "verified", "notes": "Docs check out." }
```
### `GET /api/admin/projects/pending`
### `GET /api/admin/stats`

---

## Error format
```json
{ "error": "Human-readable message" }
```
Validation errors return:
```json
{ "error": "Validation failed", "issues": [ ... Zod issues ... ] }
```
