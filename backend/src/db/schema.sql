-- =====================================================================
-- SAREGO — Southern Africa Regional Economic Growth Office
-- PostgreSQL schema (v0.1)
-- Run against an empty database. Requires Postgres 13+.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------
-- ENUMERATED TYPES
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
  'government',
  'investor',
  'corporate',
  'sme',
  'project_developer',
  'admin'
);

CREATE TYPE trust_tier AS ENUM (
  'unverified',
  'basic',
  'verified',
  'institutional'
);

CREATE TYPE project_stage AS ENUM (
  'origination',
  'preparation',
  'bankable',
  'financing',
  'execution',
  'operational',
  'closed'
);

CREATE TYPE project_status AS ENUM (
  'draft',
  'pending_review',
  'published',
  'archived',
  'rejected'
);

CREATE TYPE investor_type AS ENUM (
  'dfi',
  'private_equity',
  'venture_capital',
  'family_office',
  'sovereign_wealth',
  'corporate_strategic',
  'angel',
  'other'
);

CREATE TYPE deal_room_role AS ENUM (
  'owner',
  'editor',
  'viewer'
);

CREATE TYPE message_status AS ENUM (
  'sent',
  'delivered',
  'read'
);

CREATE TYPE verification_doc_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- ---------------------------------------------------------------------
-- COUNTRIES (seeded with SADC + key African states)
-- ---------------------------------------------------------------------
CREATE TABLE countries (
  id           SERIAL PRIMARY KEY,
  iso_code     CHAR(2) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-2
  iso_code_3   CHAR(3) NOT NULL UNIQUE,   -- ISO 3166-1 alpha-3
  name         TEXT NOT NULL,
  region       TEXT NOT NULL,             -- e.g. SADC, ECOWAS, EAC
  is_sadc      BOOLEAN NOT NULL DEFAULT false,
  flag_emoji   TEXT
);

-- ---------------------------------------------------------------------
-- SECTORS (taxonomy for projects & investor mandates)
-- ---------------------------------------------------------------------
CREATE TABLE sectors (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  parent_id    INTEGER REFERENCES sectors(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- USERS — authentication identity (one per human/login)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  role              user_role NOT NULL,
  trust_tier        trust_tier NOT NULL DEFAULT 'unverified',
  email_verified_at TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_trust_tier ON users(trust_tier);

-- ---------------------------------------------------------------------
-- ORGANIZATIONS — government bodies, funds, corporates, SMEs
-- A user may belong to one organization (extend to many-to-many later).
-- ---------------------------------------------------------------------
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  legal_name        TEXT,
  registration_no   TEXT,
  org_type          user_role NOT NULL,        -- mirrors which role uses it
  country_id        INTEGER REFERENCES countries(id),
  website           TEXT,
  description       TEXT,
  logo_url          TEXT,
  trust_tier        trust_tier NOT NULL DEFAULT 'unverified',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_country ON organizations(country_id);
CREATE INDEX idx_orgs_type ON organizations(org_type);

ALTER TABLE users
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN job_title TEXT;

CREATE INDEX idx_users_organization ON users(organization_id);

-- ---------------------------------------------------------------------
-- INVESTOR PROFILES — extra fields for investor-role accounts
-- ---------------------------------------------------------------------
CREATE TABLE investor_profiles (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  investor_type        investor_type NOT NULL,
  ticket_size_min_usd  BIGINT,
  ticket_size_max_usd  BIGINT,
  aum_usd              BIGINT,           -- assets under management
  thesis               TEXT,             -- free-text investment thesis
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sectors an investor targets (mandate)
CREATE TABLE investor_sectors (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  sector_id  INTEGER REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, sector_id)
);

-- Countries an investor targets
CREATE TABLE investor_countries (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, country_id)
);

-- ---------------------------------------------------------------------
-- VERIFICATION DOCUMENTS — uploaded for KYC review
-- ---------------------------------------------------------------------
CREATE TABLE verification_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,    -- 'passport', 'incorporation', 'tax_cert', etc.
  storage_key     TEXT NOT NULL,    -- S3/R2 object key, never the actual file
  status          verification_doc_status NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES users(id),
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verif_user ON verification_documents(user_id);
CREATE INDEX idx_verif_status ON verification_documents(status);

-- ---------------------------------------------------------------------
-- PROJECTS — the heart of the marketplace
-- ---------------------------------------------------------------------
CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  summary             TEXT NOT NULL,            -- 1-2 paragraph pitch
  description         TEXT,                     -- full markdown
  country_id          INTEGER NOT NULL REFERENCES countries(id),
  location_text       TEXT,                     -- e.g. "Maputo Province"
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  capital_required_usd BIGINT NOT NULL,
  capital_committed_usd BIGINT NOT NULL DEFAULT 0,
  expected_irr_pct    NUMERIC(5,2),             -- e.g. 14.50
  stage               project_stage NOT NULL DEFAULT 'origination',
  status              project_status NOT NULL DEFAULT 'draft',
  is_featured         BOOLEAN NOT NULL DEFAULT false,
  view_count          INTEGER NOT NULL DEFAULT 0,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_country ON projects(country_id);
CREATE INDEX idx_projects_stage ON projects(stage);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_owner ON projects(owner_user_id);
CREATE INDEX idx_projects_published ON projects(published_at DESC) WHERE status = 'published';

-- Many-to-many sectors per project
CREATE TABLE project_sectors (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sector_id  INTEGER REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, sector_id)
);

-- Public-facing project documents (teasers, summaries)
CREATE TABLE project_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  storage_key  TEXT NOT NULL,
  is_public    BOOLEAN NOT NULL DEFAULT false,    -- public teaser vs deal-room only
  uploaded_by  UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_docs_project ON project_documents(project_id);

-- ---------------------------------------------------------------------
-- TRADE OPPORTUNITIES — separate from investment projects
-- ---------------------------------------------------------------------
CREATE TYPE trade_opp_type AS ENUM ('buy', 'sell', 'partnership', 'rfp');

CREATE TABLE trade_opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  opp_type        trade_opp_type NOT NULL,
  description     TEXT NOT NULL,
  country_id      INTEGER REFERENCES countries(id),
  sector_id       INTEGER REFERENCES sectors(id),
  value_usd       BIGINT,
  status          project_status NOT NULL DEFAULT 'draft',
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_owner ON trade_opportunities(owner_user_id);
CREATE INDEX idx_trade_country ON trade_opportunities(country_id);

-- ---------------------------------------------------------------------
-- DEAL ROOMS — gated, audited document-sharing spaces
-- ---------------------------------------------------------------------
CREATE TABLE deal_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_by   UUID NOT NULL REFERENCES users(id),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_rooms_project ON deal_rooms(project_id);

CREATE TABLE deal_room_members (
  deal_room_id UUID REFERENCES deal_rooms(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  room_role    deal_room_role NOT NULL DEFAULT 'viewer',
  invited_by   UUID REFERENCES users(id),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_room_id, user_id)
);

CREATE TABLE deal_room_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id  UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  size_bytes    BIGINT,
  mime_type     TEXT,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_docs_room ON deal_room_documents(deal_room_id);

-- Audit log for deal-room access (downloads, views, invites)
CREATE TABLE deal_room_access_log (
  id            BIGSERIAL PRIMARY KEY,
  deal_room_id  UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,         -- 'view', 'download', 'invite', 'remove'
  document_id   UUID REFERENCES deal_room_documents(id),
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_log_room ON deal_room_access_log(deal_room_id);

-- ---------------------------------------------------------------------
-- INVESTMENT INTEREST — investors expressing interest in a project
-- This is the precursor to a deal room being opened.
-- ---------------------------------------------------------------------
CREATE TABLE investment_interests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ticket_usd    BIGINT,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'open',   -- open / accepted / declined / withdrawn
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(investor_id, project_id)
);

CREATE INDEX idx_interests_project ON investment_interests(project_id);
CREATE INDEX idx_interests_investor ON investment_interests(investor_id);

-- ---------------------------------------------------------------------
-- MESSAGING — threaded conversations between users
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  status          message_status NOT NULL DEFAULT 'sent',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

-- ---------------------------------------------------------------------
-- AUDIT LOG — for any privileged action
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,           -- 'kyc.approve', 'project.publish', etc.
  entity      TEXT NOT NULL,           -- table/entity name
  entity_id   TEXT,                    -- string for flexibility (UUID or int)
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- ---------------------------------------------------------------------
-- REFRESH TOKENS — for JWT refresh flow
-- ---------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,           -- bcrypt hash of the token
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  user_agent      TEXT,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- =====================================================================
-- SEED DATA
-- =====================================================================

-- SADC member states + a handful of others to demonstrate the regional scope
INSERT INTO countries (iso_code, iso_code_3, name, region, is_sadc, flag_emoji) VALUES
  ('ZA', 'ZAF', 'South Africa',                  'SADC', true,  '🇿🇦'),
  ('NA', 'NAM', 'Namibia',                       'SADC', true,  '🇳🇦'),
  ('BW', 'BWA', 'Botswana',                      'SADC', true,  '🇧🇼'),
  ('ZW', 'ZWE', 'Zimbabwe',                      'SADC', true,  '🇿🇼'),
  ('ZM', 'ZMB', 'Zambia',                        'SADC', true,  '🇿🇲'),
  ('MW', 'MWI', 'Malawi',                        'SADC', true,  '🇲🇼'),
  ('MZ', 'MOZ', 'Mozambique',                    'SADC', true,  '🇲🇿'),
  ('TZ', 'TZA', 'Tanzania',                      'SADC', true,  '🇹🇿'),
  ('AO', 'AGO', 'Angola',                        'SADC', true,  '🇦🇴'),
  ('CD', 'COD', 'Democratic Republic of Congo',  'SADC', true,  '🇨🇩'),
  ('MG', 'MDG', 'Madagascar',                    'SADC', true,  '🇲🇬'),
  ('MU', 'MUS', 'Mauritius',                     'SADC', true,  '🇲🇺'),
  ('SC', 'SYC', 'Seychelles',                    'SADC', true,  '🇸🇨'),
  ('LS', 'LSO', 'Lesotho',                       'SADC', true,  '🇱🇸'),
  ('SZ', 'SWZ', 'Eswatini',                      'SADC', true,  '🇸🇿'),
  ('KM', 'COM', 'Comoros',                       'SADC', true,  '🇰🇲'),
  ('KE', 'KEN', 'Kenya',                         'EAC',  false, '🇰🇪'),
  ('NG', 'NGA', 'Nigeria',                       'ECOWAS', false, '🇳🇬'),
  ('GH', 'GHA', 'Ghana',                         'ECOWAS', false, '🇬🇭'),
  ('EG', 'EGY', 'Egypt',                         'COMESA', false, '🇪🇬'),
  ('ET', 'ETH', 'Ethiopia',                      'COMESA', false, '🇪🇹'),
  ('RW', 'RWA', 'Rwanda',                        'EAC',    false, '🇷🇼')
ON CONFLICT DO NOTHING;

-- Sector taxonomy
INSERT INTO sectors (slug, name) VALUES
  ('energy',           'Energy & Power'),
  ('renewables',       'Renewable Energy'),
  ('mining',           'Mining & Minerals'),
  ('agriculture',      'Agriculture & Agribusiness'),
  ('infrastructure',   'Infrastructure & Transport'),
  ('logistics',        'Logistics & Ports'),
  ('manufacturing',    'Manufacturing'),
  ('financial',        'Financial Services'),
  ('tech',             'Technology & Telecoms'),
  ('healthcare',       'Healthcare & Pharma'),
  ('education',        'Education & Skills'),
  ('tourism',          'Tourism & Hospitality'),
  ('water',            'Water & Sanitation'),
  ('real_estate',      'Real Estate & Construction')
ON CONFLICT DO NOTHING;

-- Helpful: a view for the "published projects feed"
CREATE OR REPLACE VIEW published_projects AS
SELECT
  p.*,
  c.iso_code,
  c.name AS country_name,
  c.flag_emoji,
  u.full_name AS owner_name,
  o.name AS organization_name
FROM projects p
JOIN countries c ON c.id = p.country_id
JOIN users u ON u.id = p.owner_user_id
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE p.status = 'published';

-- Helper trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orgs_updated       BEFORE UPDATE ON organizations  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated   BEFORE UPDATE ON projects       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_trade_updated      BEFORE UPDATE ON trade_opportunities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_investor_updated   BEFORE UPDATE ON investor_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
