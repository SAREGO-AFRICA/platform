// SAREGO-PROFILE-UX-FIX
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, Loader2, Banknote, Building2, CheckCircle2, ExternalLink } from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

/**
 * CapitalProviderProfilePage — /my-provider-profile
 *
 * Singular institutional mandate profile for the current user's organization.
 *
 * Three conditional states:
 *   1. User's org is NOT yet a capital_provider → show upgrade CTA + institution_category select
 *   2. Org is capital_provider but no profile exists → render empty create form
 *   3. Profile exists → render prefilled edit form
 *
 * Architectural principle: ONE profile per organization.
 * Identity belongs to organizations. Mandate belongs to this profile.
 */

const INSTITUTION_CATEGORIES = [
  { value: 'bank',                      label: 'Commercial Bank' },
  { value: 'dfi',                       label: 'Development Finance Institution' },
  { value: 'trade_finance_fund',        label: 'Trade Finance Fund' },
  { value: 'commodity_finance_house',   label: 'Commodity Finance House' },
  { value: 'alternative_lender',        label: 'Alternative Lender' },
  { value: 'broker',                    label: 'Broker / Intermediary' },
  { value: 'family_office',             label: 'Family Office' },
  { value: 'export_credit_institution', label: 'Export Credit Institution' },
  { value: 'other',                     label: 'Other' },
];

const FINANCE_TYPES = [
  { value: 'pre_export',               label: 'Pre-Export Finance' },
  { value: 'working_capital',          label: 'Working Capital' },
  { value: 'invoice_finance',          label: 'Invoice / Receivables' },
  { value: 'purchase_order',           label: 'Purchase Order Finance' },
  { value: 'lc_facilitation',          label: 'LC Facilitation' },
  { value: 'supply_chain_finance',     label: 'Supply Chain Finance' },
  { value: 'structured_trade_finance', label: 'Structured Trade Finance' },
  { value: 'commodity_finance',        label: 'Commodity Finance' },
  { value: 'inventory_finance',        label: 'Inventory Finance' },
  { value: 'project_finance',          label: 'Project Finance' },
  { value: 'infrastructure_finance',   label: 'Infrastructure Finance' },
  { value: 'ppp_finance',              label: 'PPP Finance' },
  { value: 'development_finance',      label: 'Development Finance' },
];

const SECTORS = [
  { value: 'mining',         label: 'Mining' },
  { value: 'agriculture',    label: 'Agriculture' },
  { value: 'manufacturing',  label: 'Manufacturing' },
  { value: 'logistics',      label: 'Logistics' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'energy',         label: 'Energy' },
  { value: 'commodities',    label: 'Commodities' },
  { value: 'cross_sector',   label: 'Cross-sector' },
  { value: 'other',          label: 'Other' },
];

const COLLATERAL_TYPES = [
  { value: 'invoice_backed',   label: 'Invoice-backed' },
  { value: 'commodity_backed', label: 'Commodity-backed' },
  { value: 'po_backed',        label: 'Purchase-order-backed' },
  { value: 'equipment_backed', label: 'Equipment-backed' },
  { value: 'unsecured',        label: 'Unsecured' },
];

const profileSchema = z.object({
  tagline:                 z.string().trim().min(5, 'Tagline must be at least 5 characters').max(200),
  summary:                 z.string().trim().min(20, 'Summary must be at least 20 characters').max(4000),
  finance_types:           z.array(z.string()).default([]),
  sectors:                 z.array(z.string()).default([]),
  countries_covered:       z.array(z.string()).default([]),
  preferred_collateral:    z.array(z.string()).default([]),
  min_ticket_usd:          z.union([z.number().nonnegative(), z.null()]).optional(),
  max_ticket_usd:          z.union([z.number().nonnegative(), z.null()]).optional(),
  typical_turnaround_days: z.union([z.number().int().positive(), z.null()]).optional(),
  website_url:             z.string().trim().optional().or(z.literal('')),
});

export default function CapitalProviderProfilePage() {
  const navigate = useNavigate();
  const isLoggedIn = !!getAccessToken();

  const [state, setState] = useState({
    loading: true,
    organization: null,
    profile: null,
    countries: [],
  });

  const [form, setForm] = useState({
    tagline: '',
    summary: '',
    finance_types: [],
    sectors: [],
    countries_covered: [],
    preferred_collateral: [],
    min_ticket_usd: '',
    max_ticket_usd: '',
    typical_turnaround_days: '',
    website_url: '',
  });

  const [institutionCategory, setInstitutionCategory] = useState('bank');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [successFlash, setSuccessFlash] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [profileData, countryData] = await Promise.all([
          api('/api/capital-providers/me'),
          api('/api/reference/countries'),
        ]);
        if (cancelled) return;
        const p = profileData.profile;
        setState({
          loading: false,
          organization: profileData.organization,
          profile: p,
          countries: countryData.countries || [],
        });
        if (p) {
          setForm({
            tagline:                 p.tagline || '',
            summary:                 p.summary || '',
            finance_types:           p.finance_types || [],
            sectors:                 p.sectors || [],
            countries_covered:       p.countries_covered || [],
            preferred_collateral:    p.preferred_collateral || [],
            min_ticket_usd:          p.min_ticket_usd != null ? String(p.min_ticket_usd) : '',
            max_ticket_usd:          p.max_ticket_usd != null ? String(p.max_ticket_usd) : '',
            typical_turnaround_days: p.typical_turnaround_days != null ? String(p.typical_turnaround_days) : '',
            website_url:             p.website_url || '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setServerError(err.message || 'Could not load profile data');
          setState((s) => ({ ...s, loading: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <Shell>
        <WallMessage
          title="Sign in to manage your provider profile"
          body="Publishing an institutional mandate requires a verified SAREGO account associated with a capital provider organization."
          ctaLabel="Sign in"
          ctaTo={`/login?next=${encodeURIComponent(window.location.pathname)}`}
        />
      </Shell>
    );
  }

  if (state.loading) {
    return <Shell><div style={{ padding: 80, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Loading…</div></Shell>;
  }

  const org = state.organization;
  const isCapitalProviderOrg = org?.organization_type === 'capital_provider';
  const hasProfile = !!state.profile;

  // ---------- STATE 1: org is not a capital_provider ----------
  if (!isCapitalProviderOrg) {
    return (
      <Shell>
        <Hero
          eyebrow="Provider profile"
          title="Register your organization as a capital provider."
          subtitle={org
            ? `${org.name} is currently registered as a ${formatOrgType(org.organization_type)}. To publish an institutional mandate and surface trade finance opportunities matching your appetite, upgrade your organization.`
            : 'Your account must be associated with an organization. Complete KYC first.'}
        />
        {!org ? (
          <Section>
            <Link to="/kyc" className="btn btn-gold">Open KYC →</Link>
          </Section>
        ) : (
          <Section>
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Select institutional category</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18, lineHeight: 1.55 }}>
                This describes your organization's institutional archetype. Used by SAREGO to organize the institutional network. Can be refined later.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 24 }}>
                {INSTITUTION_CATEGORIES.map((c) => (
                  <label key={c.value} style={pillStyle(institutionCategory === c.value)}>
                    <input
                      type="radio"
                      name="institutionCategory"
                      value={c.value}
                      checked={institutionCategory === c.value}
                      onChange={() => setInstitutionCategory(c.value)}
                      style={{ marginRight: 8 }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              {Object.keys(errors).length > 0 && (
            <ErrorBanner message="Please review the highlighted fields above before saving." />
          )}
          {serverError && <ErrorBanner message={serverError} />}
              <button
                type="button"
                disabled={submitting}
                className="btn btn-gold"
                onClick={async () => {
                  setServerError(null);
                  setSubmitting(true);
                  try {
                    await api('/api/capital-providers/upgrade-org', {
                      method: 'POST',
                      body: JSON.stringify({ institution_category: institutionCategory }),
                    });
                    setSuccessFlash('Organization upgraded. Reloading…');
                    setTimeout(() => window.location.reload(), 700);
                  } catch (err) {
                    setServerError(err.message || 'Could not upgrade organization');
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? <><Loader2 size={16} className="spin" /> Upgrading…</> : 'Register as capital provider'}
              </button>
              {successFlash && (
                <div style={{ marginTop: 14, fontSize: 13, color: '#7fb069', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> {successFlash}
                </div>
              )}
            </Card>
          </Section>
        )}
        <style>{`.spin { animation: sarego-spin 1s linear infinite; } @keyframes sarego-spin { to { transform: rotate(360deg); } }`}</style>
      </Shell>
    );
  }

  // ---------- STATE 2 & 3: org is capital_provider; show form (create or edit) ----------
  function toggleArrayValue(field, value) {
    setForm((prev) => {
      const arr = prev[field] || [];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) };
      }
      return { ...prev, [field]: [...arr, value] };
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function buildPayload() {
    return {
      tagline:                 form.tagline.trim(),
      summary:                 form.summary.trim(),
      finance_types:           form.finance_types,
      sectors:                 form.sectors,
      countries_covered:       form.countries_covered,
      preferred_collateral:    form.preferred_collateral,
      min_ticket_usd:          form.min_ticket_usd === '' ? null : Number(form.min_ticket_usd),
      max_ticket_usd:          form.max_ticket_usd === '' ? null : Number(form.max_ticket_usd),
      typical_turnaround_days: form.typical_turnaround_days === '' ? null : parseInt(form.typical_turnaround_days, 10),
      website_url:             normalizeUrl(form.website_url) || null,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);
    setSuccessFlash(null);

    const payload = buildPayload();
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    if (payload.website_url === '') payload.website_url = null;

    setSubmitting(true);
    try {
      if (hasProfile) {
        await api(`/api/capital-providers/${state.profile.id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
        setSuccessFlash('Profile updated.');
      } else {
        await api('/api/capital-providers', { method: 'POST', body: JSON.stringify(parsed.data) });
        setSuccessFlash('Profile published. Now visible to trade finance requests matching your mandate.');
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (err) {
      setServerError(err.message || 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <Hero
        eyebrow={hasProfile ? 'Provider profile' : 'New provider profile'}
        title={hasProfile ? 'Your institutional mandate.' : 'Define your institutional mandate.'}
        subtitle={hasProfile
          ? `${org.name} · ${formatCategory(org.institution_category)}. Update your deployment parameters below.`
          : `${org.name} is now registered as a capital provider. Publish your mandate to surface compatible trade finance opportunities across SADC.`}
      />

      <Section>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* === Identity / narrative === */}
          <FormBlock title="Institutional positioning" hint="Brief institutional descriptors. Shown contextually on matched trade finance opportunities.">
            <Field label="Tagline" required error={errors.tagline} hint="One-line institutional positioning (5–200 chars).">
              <input type="text" value={form.tagline} onChange={(e) => setField('tagline', e.target.value)} maxLength={200} style={inputStyle(!!errors.tagline)} placeholder="Specialist commodity finance house — Southern African corridors" />
            </Field>
            <Field label="Mandate summary" required error={errors.summary} hint="20–4000 chars. Cover your appetite, focus areas, and how you typically structure deals.">
              <textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows={5} maxLength={4000} style={{ ...inputStyle(!!errors.summary), fontFamily: 'inherit', resize: 'vertical' }} placeholder="We deploy pre-export and working capital facilities for commodity exporters across Southern Africa. Focus: chrome, copper, lithium, agricultural softs. Typical ticket USD 2–25M. Comfortable with commodity-backed and invoice-backed structures." />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, textAlign: 'right' }}>{form.summary.length} / 4000</div>
            </Field>
          </FormBlock>

          {/* === Mandate parameters === */}
          <FormBlock title="Mandate parameters" hint="These determine which trade finance opportunities match your appetite. All multi-select.">
            <Field label="Finance types you deploy" hint="Select all you actively underwrite.">
              <CheckboxGrid options={FINANCE_TYPES} selected={form.finance_types} onChange={(v) => toggleArrayValue('finance_types', v)} />
            </Field>
            <Field label="Sectors you cover" hint="Pick your active focus sectors. Cross-sector mandates can select multiple.">
              <CheckboxGrid options={SECTORS} selected={form.sectors} onChange={(v) => toggleArrayValue('sectors', v)} />
            </Field>
            <Field label="Countries you cover" hint="Geographic mandate. Add all relevant SADC ISO-2 codes.">
              <CountryMultiSelect countries={state.countries} selected={form.countries_covered} onToggle={(iso) => toggleArrayValue('countries_covered', iso)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Min ticket (USD)" error={errors.min_ticket_usd} hint="Smallest deal size you typically engage on.">
                <input type="number" min="0" step="any" value={form.min_ticket_usd} onChange={(e) => setField('min_ticket_usd', e.target.value)} style={inputStyle(!!errors.min_ticket_usd)} placeholder="500000" />
              </Field>
              <Field label="Max ticket (USD)" error={errors.max_ticket_usd} hint="Upper bound of your typical ticket range.">
                <input type="number" min="0" step="any" value={form.max_ticket_usd} onChange={(e) => setField('max_ticket_usd', e.target.value)} style={inputStyle(!!errors.max_ticket_usd)} placeholder="25000000" />
              </Field>
            </div>
            <Field label="Collateral structures accepted" hint="Informational. Not used to filter matches — collateral is negotiable per deal.">
              <CheckboxGrid options={COLLATERAL_TYPES} selected={form.preferred_collateral} onChange={(v) => toggleArrayValue('preferred_collateral', v)} />
            </Field>
          </FormBlock>

          {/* === Institutional signal === */}
          <FormBlock title="Institutional signal" hint="Optional. Signals responsiveness and credibility to seekers.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Typical turnaround (days)" error={errors.typical_turnaround_days} hint="From initial interest to indicative decision.">
                <input type="number" min="1" max="365" step="1" value={form.typical_turnaround_days} onChange={(e) => setField('typical_turnaround_days', e.target.value)} style={inputStyle(!!errors.typical_turnaround_days)} placeholder="14" />
              </Field>
              <Field label="Institutional website" error={errors.website_url} hint="Optional. Linked from matched-provider context.">
                <input type="text" value={form.website_url} onChange={(e) => setField('website_url', e.target.value)} style={inputStyle(!!errors.website_url)} placeholder="example.com or https://example.com" />
              </Field>
            </div>
          </FormBlock>

          {Object.keys(errors).length > 0 && (
            <ErrorBanner message="Please review the highlighted fields above before saving." />
          )}
          {serverError && <ErrorBanner message={serverError} />}

          {successFlash && (
            <div style={{ padding: 14, borderRadius: 6, background: 'rgba(127,176,105,0.1)', border: '1px solid rgba(127,176,105,0.35)', color: '#a3d189', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={16} /> {successFlash}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={submitting} className="btn btn-gold">
              {submitting ? <><Loader2 size={16} className="spin" /> Saving…</> : (hasProfile ? 'Save changes' : 'Publish provider profile')}
            </button>
            {hasProfile && (
              <Link to="/provider/browse" className="btn btn-ghost-light" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Browse compatible opportunities <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </form>
      </Section>

      <style>{`.spin { animation: sarego-spin 1s linear infinite; } @keyframes sarego-spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      {children}
      <Footer />
    </div>
  );
}

function Hero({ eyebrow, title, subtitle }) {
  return (
    <section style={{ padding: '40px 0 24px' }}>
      <div className="container" style={{ maxWidth: 820 }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Banknote size={14} style={{ color: '#a087d9' }} />
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a087d9' }}>{eyebrow}</div>
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 4 }}>{title}</h1>
        <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.55, maxWidth: 720 }}>{subtitle}</p>
      </div>
    </section>
  );
}

function Section({ children }) {
  return (
    <section style={{ padding: '20px 0 64px' }}>
      <div className="container" style={{ maxWidth: 820 }}>{children}</div>
    </section>
  );
}

function Card({ children }) {
  return (
    <div style={{ padding: 28, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>{children}</div>
  );
}

function FormBlock({ title, hint, children }) {
  return (
    <div style={{ padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400, #dcc068)', marginBottom: 6 }}>{title}</div>
      {hint && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.55 }}>{hint}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--ivory-50)', marginBottom: 8 }}>
        {label}{required && <span style={{ color: '#a087d9', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {(error || hint) && (
        <div style={{ marginTop: 6, fontSize: 12, color: error ? '#e2a4a4' : 'rgba(255,255,255,0.45)' }}>{error || hint}</div>
      )}
    </div>
  );
}

function CheckboxGrid({ options, selected, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
      {options.map((opt) => {
        const isOn = selected.includes(opt.value);
        return (
          <label key={opt.value} style={pillStyle(isOn)}>
            <input type="checkbox" checked={isOn} onChange={() => onChange(opt.value)} style={{ marginRight: 8 }} />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

function CountryMultiSelect({ countries, selected, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, maxHeight: 240, overflowY: 'auto', padding: '4px 2px' }}>
      {countries.map((c) => {
        const isOn = selected.includes(c.iso_code);
        return (
          <label key={c.iso_code} style={pillStyle(isOn)}>
            <input type="checkbox" checked={isOn} onChange={() => onToggle(c.iso_code)} style={{ marginRight: 8 }} />
            {c.name}
          </label>
        );
      })}
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 14, borderRadius: 6, background: 'rgba(201,123,123,0.1)', border: '1px solid rgba(201,123,123,0.3)', color: '#e2a4a4', fontSize: 13, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>{message}</div>
    </div>
  );
}

function WallMessage({ title, body, ctaLabel, ctaTo }) {
  return (
    <section style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 14 }}>{title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 32, lineHeight: 1.55 }}>{body}</p>
        <Link to={ctaTo} className="btn btn-gold">{ctaLabel}</Link>
      </div>
    </section>
  );
}

function inputStyle(hasError) {
  return {
    width: '100%', padding: '11px 13px',
    background: 'rgba(255,255,255,0.04)', color: 'var(--ivory-50)',
    border: hasError ? '1px solid rgba(201,123,123,0.5)' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, fontSize: 14, outline: 'none',
    transition: 'border-color 150ms', boxSizing: 'border-box',
  };
}

function pillStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center',
    padding: '9px 12px',
    fontSize: 13,
    color: isActive ? 'var(--ivory-50)' : 'rgba(255,255,255,0.7)',
    background: isActive ? 'rgba(160,135,217,0.12)' : 'rgba(255,255,255,0.03)',
    border: isActive ? '1px solid rgba(160,135,217,0.5)' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'border-color 150ms, background 150ms',
  };
}

function formatOrgType(t) {
  if (!t) return 'counterparty';
  return t.replace(/_/g, ' ');
}

function formatCategory(c) {
  if (!c) return 'institution';
  return c.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


// SAREGO-PROFILE-UX-FIX helper: normalize URLs without scheme
function normalizeUrl(s) {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Accept bare 'example.com' or 'www.example.com' — prefix https://
  return 'https://' + trimmed;
}
