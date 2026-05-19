import React, { useState, useEffect } from 'react';
// SAREGO-SECTOR-PATCH (included from build template)
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, Loader2, Banknote } from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';
import ListingPreview from '../components/ListingPreview.jsx';
// SAREGO-PREVIEW-PATCH

/**
 * TradeFinanceFormPage — request trade finance.
 *
 * SAREGO's trade finance layer is positioned as economic flow enablement,
 * not bank-product application. Copy is intentionally non-bank-jargon:
 *   - "Request Trade Finance" not "Apply for loan"
 *   - "Express interest" not "Submit offer"
 *   - "Indicative funding need" not "Loan amount"
 *
 * Routes:
 *   /opportunities/trade_finance/new        → create
 *   /opportunities/trade_finance/:id/edit   → edit
 */

const FINANCE_TYPES = [
  { value: 'pre_export',       label: 'Pre-Export Finance',     hint: 'Finance production or shipment before export. Common for commodity exporters, agricultural producers, mining operations.' },
  { value: 'working_capital',  label: 'Working Capital',         hint: 'Operating liquidity to fulfill contracts, tender awards, or production cycles.' },
  { value: 'invoice_finance',  label: 'Invoice / Receivables',   hint: 'Advance cash against unpaid invoices. Useful for suppliers, logistics providers, government contractors.' },
  { value: 'purchase_order',   label: 'Purchase Order Finance',  hint: 'Finance fulfillment of confirmed purchase orders or procurement awards.' },
  { value: 'lc_facilitation',  label: 'LC Facilitation',         hint: 'Connect with institutions for letter of credit issuance or confirmation. Cross-border trade assurance.' },
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

const TRADE_CONTEXTS = [
  { value: 'purchase_order',   label: 'Confirmed purchase order' },
  { value: 'export_contract',  label: 'Export contract' },
  { value: 'invoice',          label: 'Invoice issued' },
  { value: 'tender_award',     label: 'Tender awarded' },
  { value: 'supply_agreement', label: 'Supply agreement' },
  { value: 'other',            label: 'Other' },
];

const TIMELINES = [
  { value: 'immediate',         label: 'Immediate / Urgent (≤ 14 days)' },
  { value: 'short_term',        label: 'Short-term (30–90 days)' },
  { value: 'medium_term',       label: 'Medium-term (3–12 months)' },
  { value: 'rolling_facility',  label: 'Rolling facility' },
];

const COLLATERAL_TYPES = [
  { value: 'invoice_backed',   label: 'Invoice-backed' },
  { value: 'commodity_backed', label: 'Commodity-backed' },
  { value: 'po_backed',        label: 'Purchase-order-backed' },
  { value: 'equipment_backed', label: 'Equipment-backed' },
  { value: 'unsecured',        label: 'Unsecured' },
];

// Mirrors backend CREATE_SCHEMAS.trade_finance
const schema = z.object({
  title:                   z.string().trim().min(5,  'Title must be at least 5 characters').max(200),
  summary:                 z.string().trim().min(20, 'Summary must be at least 20 characters').max(2000),
  country_iso:             z.string().trim().regex(/^[A-Z]{2}$/, 'Select a country'),
  destination_country_iso: z.string().trim().regex(/^[A-Z]{2}$/).optional().nullable(),
  value_usd:               z.union([z.number().nonnegative(), z.nan().transform(() => null)]).optional().nullable(),
  expires_at:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a closing date').optional(),
  sector:                  z.enum(['mining', 'agriculture', 'manufacturing', 'logistics', 'infrastructure', 'energy', 'commodities', 'cross_sector', 'other'], { errorMap: () => ({ message: 'Pick a sector' }) }),
  finance_type:            z.enum(['pre_export', 'working_capital', 'invoice_finance', 'purchase_order', 'lc_facilitation'], { errorMap: () => ({ message: 'Pick a finance type' }) }),
  trade_context:           z.enum(['purchase_order', 'export_contract', 'invoice', 'tender_award', 'supply_agreement', 'other'], { errorMap: () => ({ message: 'Pick a trade context' }) }),
  contract_reference:      z.string().trim().max(160).optional().nullable(),
  finance_timeline:        z.enum(['immediate', 'short_term', 'medium_term', 'rolling_facility'], { errorMap: () => ({ message: 'Pick a timeline' }) }),
  collateral_type:         z.enum(['invoice_backed', 'commodity_backed', 'po_backed', 'unsecured', 'equipment_backed'], { errorMap: () => ({ message: 'Pick a collateral type' }) }),
});

export default function TradeFinanceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const isLoggedIn = !!getAccessToken();

  const [form, setForm] = useState({
    title: '',
    summary: '',
    country_iso: '',
    destination_country_iso: '',
    value_usd: '',
    expires_at: defaultExpiry(),
    sector: 'commodities',
    finance_type: 'pre_export',
    trade_context: 'export_contract',
    contract_reference: '',
    finance_timeline: 'short_term',
    collateral_type: 'commodity_backed',
  });
  const [countries, setCountries] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countryData, meData] = await Promise.all([
          api('/api/reference/countries'),
          isLoggedIn ? api('/api/auth/me').catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) setCountries(countryData.countries || []);

        if (isEdit) {
          const data = await api(`/api/opportunities/trade_finance/${id}`);
          if (cancelled) return;
          if (meData?.user && data.opportunity?.owner_user_id !== meData.user.id) {
            navigate(`/opportunities/trade_finance/${id}`);
            return;
          }
          const opp = data.opportunity;
          setForm({
            title:                   opp.title || '',
            summary:                 opp.summary || '',
            country_iso:             opp.country_iso || '',
            destination_country_iso: opp.destination_country_iso || '',
            value_usd:               opp.value_usd != null ? String(opp.value_usd) : '',
            expires_at:              opp.expires_at ? opp.expires_at.slice(0, 10) : defaultExpiry(),
            sector:                  opp.sector || 'commodities',
            finance_type:            opp.finance_type || 'pre_export',
            trade_context:           opp.trade_context || 'export_contract',
            contract_reference:      opp.contract_reference || '',
            finance_timeline:        opp.finance_timeline || 'short_term',
            collateral_type:         opp.collateral_type || 'commodity_backed',
          });
          setLoadingExisting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setServerError(err.message || 'Could not load form data');
          setLoadingExisting(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, isLoggedIn, navigate]);

  if (!isLoggedIn) {
    const next = encodeURIComponent(window.location.pathname);
    return (
      <Shell>
        <WallMessage
          title="Sign in to request trade finance"
          body="Publishing trade finance requests requires a verified institutional account on SAREGO."
          ctaLabel="Sign in"
          ctaTo={`/login?next=${next}`}
        />
      </Shell>
    );
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function buildPayload() {
    return {
      title:                   form.title.trim(),
      summary:                 form.summary.trim(),
      country_iso:             form.country_iso,
      destination_country_iso: form.destination_country_iso || null,
      value_usd:               form.value_usd === '' ? null : Number(form.value_usd),
      expires_at:              form.expires_at || undefined,
      sector:                  form.sector,
      finance_type:            form.finance_type,
      trade_context:           form.trade_context,
      contract_reference:      form.contract_reference?.trim() || null,
      finance_timeline:        form.finance_timeline,
      collateral_type:         form.collateral_type,
    };
  }

  function handlePreview() {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    const payload = buildPayload();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setPreviewData(parsed.data);
    setShowPreview(true);
    setTimeout(() => {
      document.getElementById('sarego-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);

    const payload = buildPayload();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await api(`/api/opportunities/trade_finance/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
        navigate(`/opportunities/trade_finance/${id}`);
      } else {
        await api('/api/opportunities/trade_finance', { method: 'POST', body: JSON.stringify(parsed.data) });
        navigate('/my-listings');
      }
    } catch (err) {
      const msg = err.message || 'Could not save your finance request.';
      if (msg.includes('403') || msg.toLowerCase().includes('verified')) {
        setServerError('Your account must be KYC-verified to publish finance requests. Open KYC to continue.');
      } else {
        setServerError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingExisting) {
    return <Shell><div style={{ padding: 80, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Loading…</div></Shell>;
  }

  // Find the helper hint for the currently-selected finance_type
  const financeTypeMeta = FINANCE_TYPES.find((t) => t.value === form.finance_type);

  return (
    <Shell>
      <section style={{ padding: '40px 0 24px' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <Link to="/my-listings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 20 }}>
            <ArrowLeft size={14} /> Back to my listings
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Banknote size={14} style={{ color: '#a087d9' }} />
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a087d9' }}>
              {isEdit ? 'Edit finance request' : 'Request trade finance'}
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 4 }}>
            {isEdit ? 'Edit trade finance request' : 'New trade finance request'}
          </h1>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.55, maxWidth: 620 }}>
            Surface your trade finance need to institutional capital providers across SADC. Banks, DFIs, trade finance funds and alternative lenders can express interest.
            All fields marked <span style={{ color: '#a087d9' }}>*</span> are required.
          </p>
        </div>
      </section>

      <section style={{ padding: '20px 0 64px' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Field label="Title" required error={errors.title} hint="e.g. 'Pre-export finance — Chrome concentrate, Zimbabwe to South Africa'">
              <input type="text" value={form.title} onChange={(e) => setField('title', e.target.value)} maxLength={200} style={inputStyle(!!errors.title)} placeholder="Working capital — TANROADS subcontract execution" />
            </Field>

            <Field label="Summary" required error={errors.summary} hint="20–2000 chars. Describe the trade flow, transaction context, and what makes this opportunity actionable.">
              <textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows={5} maxLength={2000} style={{ ...inputStyle(!!errors.summary), fontFamily: 'inherit', resize: 'vertical' }} placeholder="Mozambican freight forwarder fulfilling a Tanzania road rehabilitation subcontract. Need working capital to bridge invoicing cycle against confirmed PO with MoU…" />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, textAlign: 'right' }}>{form.summary.length} / 2000</div>
            </Field>

            <Field label="Finance type" required error={errors.finance_type} hint={financeTypeMeta?.hint}>
              <select value={form.finance_type} onChange={(e) => setField('finance_type', e.target.value)} style={inputStyle(!!errors.finance_type)}>
                {FINANCE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </Field>

            <Field label="Sector" required error={errors.sector} hint="The primary economic sector for this finance request.">
              <select value={form.sector} onChange={(e) => setField('sector', e.target.value)} style={inputStyle(!!errors.sector)}>
                {SECTORS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Origin country" required error={errors.country_iso} hint="Where the trade activity originates.">
                <select value={form.country_iso} onChange={(e) => setField('country_iso', e.target.value)} style={inputStyle(!!errors.country_iso)}>
                  <option value="">Select a country</option>
                  {(countries || []).map((c) => (<option key={c.iso_code} value={c.iso_code}>{c.name}</option>))}
                </select>
              </Field>
              <Field label="Destination country" error={errors.destination_country_iso} hint="Optional. For cross-border trade.">
                <select value={form.destination_country_iso} onChange={(e) => setField('destination_country_iso', e.target.value)} style={inputStyle(!!errors.destination_country_iso)}>
                  <option value="">— None / Domestic</option>
                  {(countries || []).map((c) => (<option key={c.iso_code} value={c.iso_code}>{c.name}</option>))}
                </select>
              </Field>
            </div>

            <Field label="Indicative funding need (USD)" error={errors.value_usd} hint="Approximate amount. Capital providers use this to filter ticket-size compatibility.">
              <input type="number" min="0" step="any" value={form.value_usd} onChange={(e) => setField('value_usd', e.target.value)} style={inputStyle(!!errors.value_usd)} placeholder="2500000" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Trade context" required error={errors.trade_context} hint="What underlies the finance need.">
                <select value={form.trade_context} onChange={(e) => setField('trade_context', e.target.value)} style={inputStyle(!!errors.trade_context)}>
                  {TRADE_CONTEXTS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </Field>
              <Field label="Contract reference" error={errors.contract_reference} hint="Optional. Internal reference for matching.">
                <input type="text" value={form.contract_reference} onChange={(e) => setField('contract_reference', e.target.value)} maxLength={160} style={inputStyle(!!errors.contract_reference)} placeholder="PO-2026-0457" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Timeline" required error={errors.finance_timeline} hint="When funding is needed.">
                <select value={form.finance_timeline} onChange={(e) => setField('finance_timeline', e.target.value)} style={inputStyle(!!errors.finance_timeline)}>
                  {TIMELINES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </Field>
              <Field label="Collateral / security" required error={errors.collateral_type} hint="The security underlying the request.">
                <select value={form.collateral_type} onChange={(e) => setField('collateral_type', e.target.value)} style={inputStyle(!!errors.collateral_type)}>
                  {COLLATERAL_TYPES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </Field>
            </div>

            <Field label="Closing date" required error={errors.expires_at} hint="When this request closes to new provider interest.">
              <input type="date" value={form.expires_at} onChange={(e) => setField('expires_at', e.target.value)} min={new Date().toISOString().slice(0, 10)} style={inputStyle(!!errors.expires_at)} />
            </Field>

            {serverError && (
              <div style={{ padding: 14, borderRadius: 6, background: 'rgba(201,123,123,0.1)', border: '1px solid rgba(201,123,123,0.3)', color: '#e2a4a4', fontSize: 13, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>{serverError}{serverError.toLowerCase().includes('kyc') && (<> <Link to="/kyc" style={{ color: '#e2a4a4', textDecoration: 'underline', marginLeft: 4 }}>Open KYC →</Link></>)}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="submit" disabled={submitting} className="btn btn-gold">
                {submitting ? <><Loader2 size={16} className="spin" /> Saving…</> : (isEdit ? 'Save changes' : 'Publish finance request')}
              </button>
              <button type="button" onClick={handlePreview} className="btn btn-ghost-light">{showPreview ? 'Hide preview' : 'Preview'}</button>
              <Link to="/my-listings" className="btn btn-ghost-light">Cancel</Link>
            </div>
          </form>

          {showPreview && previewData && (
            <div id="sarego-preview" style={{ marginTop: 36 }}>
              <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a087d9', marginBottom: 12 }}>
                Preview
              </div>
              <ListingPreview type="trade_finance" data={previewData} />
            </div>
          )}

          <style>{`.spin { animation: sarego-spin 1s linear infinite; } @keyframes sarego-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </section>
    </Shell>
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

function inputStyle(hasError) {
  return {
    width: '100%', padding: '11px 13px',
    background: 'rgba(255,255,255,0.04)', color: 'var(--ivory-50)',
    border: hasError ? '1px solid rgba(201,123,123,0.5)' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, fontSize: 14, outline: 'none',
    transition: 'border-color 150ms', boxSizing: 'border-box',
  };
}

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      {children}
      <Footer />
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

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString().slice(0, 10);
}
