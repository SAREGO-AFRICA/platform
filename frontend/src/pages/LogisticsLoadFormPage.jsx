import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

/**
 * LogisticsLoadFormPage — unified create + edit form for logistics loads.
 * Routes:
 *   /opportunities/logistics_load/new        → create
 *   /opportunities/logistics_load/:id/edit   → edit
 */

const schema = z.object({
  title:                   z.string().trim().min(5, 'Title must be at least 5 characters').max(200),
  summary:                 z.string().trim().min(20, 'Summary must be at least 20 characters').max(2000),
  origin_country_iso:      z.string().trim().regex(/^[A-Z]{2}$/, 'Origin country required'),
  origin_city:             z.string().trim().min(2, 'Origin city is required').max(120),
  destination_country_iso: z.string().trim().regex(/^[A-Z]{2}$/, 'Destination country required'),
  destination_city:        z.string().trim().min(2, 'Destination city is required').max(120),
  cargo_type:              z.string().trim().min(2, 'Cargo type is required').max(160),
  weight_tons:             z.union([z.number().positive(), z.nan().transform(() => null)]).optional().nullable(),
  load_date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a load date').optional().nullable(),
  country_iso:             z.string().trim().regex(/^[A-Z]{2}$/),
  value_usd:               z.union([z.number().nonnegative(), z.nan().transform(() => null)]).optional().nullable(),
  expires_at:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a closing date').optional(),
});

export default function LogisticsLoadFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const isLoggedIn = !!getAccessToken();

  const [form, setForm] = useState({
    title: '', summary: '',
    origin_country_iso: '', origin_city: '',
    destination_country_iso: '', destination_city: '',
    cargo_type: '', weight_tons: '', load_date: '',
    value_usd: '', expires_at: defaultExpiry(),
  });
  const [countries, setCountries] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
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
          const data = await api(`/api/opportunities/logistics_load/${id}`);
          if (cancelled) return;
          if (meData?.user && data.opportunity?.owner_user_id !== meData.user.id) {
            navigate(`/opportunities/logistics_load/${id}`);
            return;
          }
          const opp = data.opportunity;
          setForm({
            title: opp.title || '',
            summary: opp.summary || '',
            origin_country_iso: opp.origin_country_iso || '',
            origin_city: opp.origin_city || '',
            destination_country_iso: opp.destination_country_iso || '',
            destination_city: opp.destination_city || '',
            cargo_type: opp.cargo_type || '',
            weight_tons: opp.weight_tons != null ? String(opp.weight_tons) : '',
            load_date: opp.load_date ? opp.load_date.slice(0, 10) : '',
            value_usd: opp.value_usd != null ? String(opp.value_usd) : '',
            expires_at: opp.expires_at ? opp.expires_at.slice(0, 10) : defaultExpiry(),
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
          title="Sign in to post a logistics load"
          body="Posting logistics opportunities requires a verified institutional account on SAREGO."
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

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);

    // `country_iso` (the "primary country" indexing field) defaults to origin
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      origin_country_iso: form.origin_country_iso,
      origin_city: form.origin_city.trim(),
      destination_country_iso: form.destination_country_iso,
      destination_city: form.destination_city.trim(),
      cargo_type: form.cargo_type.trim(),
      weight_tons: form.weight_tons === '' ? null : Number(form.weight_tons),
      load_date: form.load_date || null,
      country_iso: form.origin_country_iso, // primary country = origin
      value_usd: form.value_usd === '' ? null : Number(form.value_usd),
      expires_at: form.expires_at || undefined,
    };

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
        await api(`/api/opportunities/logistics_load/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
        navigate(`/opportunities/logistics_load/${id}`);
      } else {
        await api('/api/opportunities/logistics_load', { method: 'POST', body: JSON.stringify(parsed.data) });
        navigate('/my-listings');
      }
    } catch (err) {
      const msg = err.message || 'Could not save your listing.';
      if (msg.includes('403') || msg.toLowerCase().includes('verified')) {
        setServerError('Your account must be KYC-verified to post listings. Open KYC to continue.');
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

  return (
    <Shell>
      <section style={{ padding: '40px 0 24px' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <Link to="/my-listings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 20 }}>
            <ArrowLeft size={14} /> Back to my listings
          </Link>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 8 }}>
            {isEdit ? 'Edit listing' : 'Post a listing'}
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 4 }}>
            {isEdit ? 'Edit logistics load' : 'New logistics load'}
          </h1>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.55, maxWidth: 620 }}>
            Publish a freight load to verified transporters across SADC corridors. All fields marked <span style={{ color: 'var(--gold-400)' }}>*</span> are required.
          </p>
        </div>
      </section>

      <section style={{ padding: '20px 0 64px' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Field label="Title" required error={errors.title} hint="e.g. 'Copper Concentrate — Kolwezi to Durban'">
              <input type="text" value={form.title} onChange={(e) => setField('title', e.target.value)} maxLength={200} style={inputStyle(!!errors.title)} placeholder="Maize — Choma to Bulawayo" />
            </Field>

            <Field label="Summary" required error={errors.summary} hint="20–2000 chars. Cargo details, transit terms, requirements.">
              <textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows={5} maxLength={2000} style={{ ...inputStyle(!!errors.summary), fontFamily: 'inherit', resize: 'vertical' }} placeholder="4 x 30t containerised copper concentrate loads, weekly recurring. Bonded transit required." />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, textAlign: 'right' }}>{form.summary.length} / 2000</div>
            </Field>

            {/* Origin */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 14 }}>Origin</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Country" required error={errors.origin_country_iso}>
                  <select value={form.origin_country_iso} onChange={(e) => setField('origin_country_iso', e.target.value)} style={inputStyle(!!errors.origin_country_iso)}>
                    <option value="">Select country</option>
                    {(countries || []).map((c) => (<option key={c.iso_code} value={c.iso_code}>{c.name}</option>))}
                  </select>
                </Field>
                <Field label="City" required error={errors.origin_city}>
                  <input type="text" value={form.origin_city} onChange={(e) => setField('origin_city', e.target.value)} maxLength={120} style={inputStyle(!!errors.origin_city)} placeholder="Kolwezi" />
                </Field>
              </div>
            </div>

            {/* Destination */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 14 }}>Destination</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Country" required error={errors.destination_country_iso}>
                  <select value={form.destination_country_iso} onChange={(e) => setField('destination_country_iso', e.target.value)} style={inputStyle(!!errors.destination_country_iso)}>
                    <option value="">Select country</option>
                    {(countries || []).map((c) => (<option key={c.iso_code} value={c.iso_code}>{c.name}</option>))}
                  </select>
                </Field>
                <Field label="City" required error={errors.destination_city}>
                  <input type="text" value={form.destination_city} onChange={(e) => setField('destination_city', e.target.value)} maxLength={120} style={inputStyle(!!errors.destination_city)} placeholder="Durban" />
                </Field>
              </div>
            </div>

            <Field label="Cargo type" required error={errors.cargo_type} hint="e.g. 'copper concentrate', 'maize (bulk)', 'containerised FMCG'">
              <input type="text" value={form.cargo_type} onChange={(e) => setField('cargo_type', e.target.value)} maxLength={160} style={inputStyle(!!errors.cargo_type)} placeholder="copper concentrate" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Weight (tons)" error={errors.weight_tons} hint="Optional.">
                <input type="number" min="0" step="any" value={form.weight_tons} onChange={(e) => setField('weight_tons', e.target.value)} style={inputStyle(!!errors.weight_tons)} placeholder="120" />
              </Field>
              <Field label="Load date" error={errors.load_date} hint="Pickup date.">
                <input type="date" value={form.load_date} onChange={(e) => setField('load_date', e.target.value)} min={new Date().toISOString().slice(0, 10)} style={inputStyle(!!errors.load_date)} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Indicative value (USD)" error={errors.value_usd} hint="Optional freight value.">
                <input type="number" min="0" step="any" value={form.value_usd} onChange={(e) => setField('value_usd', e.target.value)} style={inputStyle(!!errors.value_usd)} placeholder="95000" />
              </Field>
              <Field label="Closing date" required error={errors.expires_at} hint="When this load closes to new bids.">
                <input type="date" value={form.expires_at} onChange={(e) => setField('expires_at', e.target.value)} min={new Date().toISOString().slice(0, 10)} style={inputStyle(!!errors.expires_at)} />
              </Field>
            </div>

            {serverError && (
              <div style={{ padding: 14, borderRadius: 6, background: 'rgba(201,123,123,0.1)', border: '1px solid rgba(201,123,123,0.3)', color: '#e2a4a4', fontSize: 13, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>{serverError}{serverError.toLowerCase().includes('kyc') && (<> <Link to="/kyc" style={{ color: '#e2a4a4', textDecoration: 'underline', marginLeft: 4 }}>Open KYC →</Link></>)}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="submit" disabled={submitting} className="btn btn-gold">
                {submitting ? <><Loader2 size={16} className="spin" /> Saving…</> : (isEdit ? 'Save changes' : 'Publish listing')}
              </button>
              <Link to="/my-listings" className="btn btn-ghost-light">Cancel</Link>
            </div>
          </form>
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
        {label}{required && <span style={{ color: 'var(--gold-400)', marginLeft: 4 }}>*</span>}
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
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
