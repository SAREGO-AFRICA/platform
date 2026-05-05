import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const STAGES = [
  { value: 'origination', label: 'Origination', hint: 'Concept stage; high-level outline only' },
  { value: 'preparation', label: 'Preparation', hint: 'Pre-feasibility / scoping work underway' },
  { value: 'bankable',    label: 'Bankable',    hint: 'Feasibility complete, structuring for capital' },
  { value: 'financing',   label: 'Financing',   hint: 'Active capital raise; term sheets in flight' },
  { value: 'execution',   label: 'Execution',   hint: 'Construction / implementation phase' },
];

const ELIGIBLE_ROLES = ['project_developer', 'government', 'corporate', 'admin'];

export default function ProjectFormPage() {
  const { id } = useParams();           // present when editing existing
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // Auth + reference data
  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Form state
  const [form, setForm] = useState({
    title: '',
    summary: '',
    description: '',
    country_iso: '',
    location_text: '',
    capital_required_usd: '',
    capital_required_unit: 'M',  // M | B — UI affordance
    expected_irr_pct: '',
    stage: 'origination',
    sector_slugs: [],
  });

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedProject, setSavedProject] = useState(null);

  // Bootstrap: confirm auth, load reference data, optionally load existing project
  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [me, countriesRes, sectorsRes] = await Promise.all([
          api('/api/auth/me'),
          api('/api/reference/countries'),
          api('/api/reference/sectors'),
        ]);
        if (cancelled) return;

        if (!ELIGIBLE_ROLES.includes(me.user.role)) {
          setAuthError(
            'Your account role cannot publish projects. Only developers, governments, and corporates can submit to the marketplace.'
          );
          setUser(me.user);
          return;
        }

        setUser(me.user);
        setCountries(countriesRes.countries || []);
        setSectors(sectorsRes.sectors || []);

        if (isEdit) {
          const data = await api(`/api/projects/${id}/edit`);
          if (cancelled) return;
          const p = data.project;
          // Decompose capital amount into M/B
          const cap = Number(p.capital_required_usd || 0);
          const unit = cap >= 1_000_000_000 ? 'B' : 'M';
          const value = unit === 'B' ? cap / 1_000_000_000 : cap / 1_000_000;
          setForm({
            title: p.title || '',
            summary: p.summary || '',
            description: p.description || '',
            country_iso: p.iso_code || '',
            location_text: p.location_text || '',
            capital_required_usd: value ? String(value) : '',
            capital_required_unit: unit,
            expected_irr_pct: p.expected_irr_pct ? String(p.expected_irr_pct) : '',
            stage: p.stage || 'origination',
            sector_slugs: Array.isArray(p.sector_slugs) ? p.sector_slugs : [],
          });
          setSavedProject(p);
        }
      } catch (err) {
        if (err.status === 401) {
          navigate('/login');
        } else {
          setAuthError(err.message || 'Failed to load form');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, navigate]);

  // Selected country (for display only)
  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso_code === form.country_iso),
    [countries, form.country_iso]
  );

  // Validation — derived; matches backend schema
  const errors = useMemo(() => {
    const e = {};
    if (form.title.trim().length < 4) e.title = 'At least 4 characters';
    if (form.title.length > 200) e.title = 'Maximum 200 characters';
    if (form.summary.trim().length < 20) e.summary = 'At least 20 characters';
    if (form.summary.length > 1000) e.summary = 'Maximum 1,000 characters';
    if (form.description.length > 20_000) e.description = 'Maximum 20,000 characters';
    if (!form.country_iso) e.country_iso = 'Select a country';
    const cap = Number(form.capital_required_usd);
    if (!cap || cap <= 0) e.capital_required_usd = 'Enter a positive amount';
    if (form.expected_irr_pct !== '') {
      const n = Number(form.expected_irr_pct);
      if (Number.isNaN(n) || n < 0 || n > 100) e.expected_irr_pct = 'Between 0 and 100';
    }
    if (!form.sector_slugs.length) e.sector_slugs = 'Select at least one sector';
    if (form.sector_slugs.length > 5) e.sector_slugs = 'Maximum 5 sectors';
    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  function update(field, value) {
    setForm((s) => ({ ...s, [field]: value }));
  }

  function toggleSector(slug) {
    setForm((s) => {
      if (s.sector_slugs.includes(slug)) {
        return { ...s, sector_slugs: s.sector_slugs.filter((x) => x !== slug) };
      }
      if (s.sector_slugs.length >= 5) return s; // limit
      return { ...s, sector_slugs: [...s.sector_slugs, slug] };
    });
  }

  function buildPayload() {
    const multiplier = form.capital_required_unit === 'B' ? 1_000_000_000 : 1_000_000;
    return {
      title: form.title.trim(),
      summary: form.summary.trim(),
      description: form.description.trim() || undefined,
      country_iso: form.country_iso,
      location_text: form.location_text.trim() || undefined,
      capital_required_usd: Math.round(Number(form.capital_required_usd) * multiplier),
      expected_irr_pct: form.expected_irr_pct === '' ? undefined : Number(form.expected_irr_pct),
      stage: form.stage,
      sector_slugs: form.sector_slugs,
    };
  }

  // Save: creates a new draft or updates an existing draft
  async function handleSave() {
    setSubmitError(null);
    if (!isValid) {
      setSubmitError('Please correct the highlighted fields before saving.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const res = isEdit
        ? await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      setSavedProject(res.project);
      // If creating, redirect to the edit URL so further saves go to PUT
      if (!isEdit) navigate(`/projects/${res.project.id}/edit`, { replace: true });
    } catch (err) {
      setSubmitError(formatBackendError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Submit for review: save first, then call publish endpoint
  async function handleSubmitForReview() {
    setSubmitError(null);
    if (!isValid) {
      setSubmitError('Please correct the highlighted fields before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const saved = isEdit
        ? await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      const projectId = saved.project.id;
      const published = await api(`/api/projects/${projectId}/publish`, { method: 'POST' });
      setSavedProject(published.project);
    } catch (err) {
      setSubmitError(formatBackendError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80 }}>
          <div className="muted text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80, maxWidth: 640 }}>
          <h2>Permission required</h2>
          <p className="muted" style={{ marginTop: 16 }}>{authError}</p>
          <Link to="/dashboard" className="btn btn-ghost" style={{ marginTop: 24 }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // --------- After successful submit-for-review --------------------------
  if (savedProject?.status === 'pending_review') {
    return <SuccessScreen project={savedProject} type="review" />;
  }
  if (savedProject?.status === 'published') {
    return <SuccessScreen project={savedProject} type="published" />;
  }

  return (
    <div style={{ background: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="light" />

      {/* Header band */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-5)' }}>
        <div className="container" style={{ maxWidth: 920 }}>
          <Link
            to="/dashboard"
            className="text-xs uppercase muted fade-up"
            style={{ letterSpacing: '0.16em', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={12} /> Dashboard
          </Link>

          <div className="eyebrow fade-up fade-up-1" style={{ marginTop: 22 }}>
            {isEdit ? 'Edit Project' : 'New Project Submission'}
          </div>

          <h1
            className="display fade-up fade-up-2"
            style={{ marginTop: 12, fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 500 }}
          >
            {isEdit ? (
              <>Editing <span style={{ fontStyle: 'italic', color: 'var(--gold-700)' }}>draft.</span></>
            ) : (
              <>Submit a project to the <span style={{ fontStyle: 'italic', color: 'var(--gold-700)' }}>regional pipeline.</span></>
            )}
          </h1>

          <p className="muted fade-up fade-up-3" style={{ marginTop: 14, fontSize: 16, maxWidth: 720, lineHeight: 1.6 }}>
            All submissions are reviewed by SAREGO before publication. You can save progress as a
            draft and return any time to refine before submitting for review.
          </p>

          {savedProject?.status === 'pending_review' && (
            <StatusBanner status="pending_review" />
          )}
          {savedProject?.status === 'rejected' && (
            <StatusBanner status="rejected" />
          )}
        </div>
      </section>

      <hr className="gold-rule" style={{ maxWidth: 1320, marginInline: 'auto' }} />

      {/* Form body */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
        <div className="container" style={{ maxWidth: 920 }}>

          {/* Section 1: Identity */}
          <FormSection
            number="01"
            title="Identity"
            subtitle="Headline and pitch — what investors see first."
          >
            <Field
              label="Project title"
              hint="Short, specific, recognizable. Avoid acronyms."
              error={errors.title}
              counter={`${form.title.length}/200`}
            >
              <input
                className="input"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Beira–Tete Solar Corridor"
                maxLength={200}
              />
            </Field>

            <Field
              label="Executive summary"
              hint="One to two paragraphs. Surface the structure, capital ask, and counterparty in plain language."
              error={errors.summary}
              counter={`${form.summary.length}/1000`}
            >
              <textarea
                className="textarea"
                rows={4}
                value={form.summary}
                onChange={(e) => update('summary', e.target.value)}
                maxLength={1000}
                style={{ resize: 'vertical' }}
                placeholder="120 MW utility-scale solar PV anchored on a 20-year PPA with EDM..."
              />
            </Field>

            <Field
              label="Full description"
              hint="Optional. Detailed thesis, structure, technical specs, milestones. Markdown supported."
              error={errors.description}
              counter={`${form.description.length}/20000`}
            >
              <textarea
                className="textarea"
                rows={8}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                maxLength={20_000}
                style={{ resize: 'vertical' }}
                placeholder="The project comprises..."
              />
            </Field>
          </FormSection>

          {/* Section 2: Geography */}
          <FormSection
            number="02"
            title="Geography"
            subtitle="Where the project sits."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} data-grid-2>
              <Field label="Country" error={errors.country_iso}>
                <select
                  className="select"
                  value={form.country_iso}
                  onChange={(e) => update('country_iso', e.target.value)}
                >
                  <option value="">Select country…</option>
                  <optgroup label="SADC">
                    {countries.filter((c) => c.is_sadc).map((c) => (
                      <option key={c.iso_code} value={c.iso_code}>
                        {c.flag_emoji} {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Africa">
                    {countries.filter((c) => !c.is_sadc).map((c) => (
                      <option key={c.iso_code} value={c.iso_code}>
                        {c.flag_emoji} {c.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {selectedCountry && (
                  <div className="text-xs muted" style={{ marginTop: 6 }}>
                    {selectedCountry.region} · ISO {selectedCountry.iso_code_3}
                  </div>
                )}
              </Field>

              <Field label="Location (optional)" hint="Province, city, or region.">
                <input
                  className="input"
                  value={form.location_text}
                  onChange={(e) => update('location_text', e.target.value)}
                  placeholder="e.g. Manica Province"
                  maxLength={200}
                />
              </Field>
            </div>
          </FormSection>

          {/* Section 3: Capital structure */}
          <FormSection
            number="03"
            title="Capital structure"
            subtitle="Headline financial parameters."
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }} data-grid-2>
              <Field label="Capital required" error={errors.capital_required_usd} hint="Total capital sought.">
                <div style={{ display: 'flex', gap: 0 }}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.capital_required_usd}
                    onChange={(e) => update('capital_required_usd', e.target.value)}
                    placeholder="e.g. 180"
                    style={{ borderRight: 'none' }}
                  />
                  <select
                    className="select"
                    value={form.capital_required_unit}
                    onChange={(e) => update('capital_required_unit', e.target.value)}
                    style={{ flex: '0 0 90px', borderLeft: 'none' }}
                  >
                    <option value="M">$M</option>
                    <option value="B">$B</option>
                  </select>
                </div>
              </Field>

              <Field label="Target IRR (%)" hint="Optional. Indicative net IRR." error={errors.expected_irr_pct}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.expected_irr_pct}
                  onChange={(e) => update('expected_irr_pct', e.target.value)}
                  placeholder="e.g. 14.5"
                />
              </Field>
            </div>
          </FormSection>

          {/* Section 4: Stage */}
          <FormSection
            number="04"
            title="Pipeline stage"
            subtitle="Where the project sits in the deal lifecycle."
          >
            <div style={{ display: 'grid', gap: 8 }}>
              {STAGES.map((s) => (
                <StageOption
                  key={s.value}
                  selected={form.stage === s.value}
                  onClick={() => update('stage', s.value)}
                  label={s.label}
                  hint={s.hint}
                />
              ))}
            </div>
          </FormSection>

          {/* Section 5: Sectors */}
          <FormSection
            number="05"
            title="Sectors"
            subtitle="Up to five. Used by the matchmaking engine to align with investor mandates."
          >
            <Field error={errors.sector_slugs}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sectors.map((s) => {
                  const active = form.sector_slugs.includes(s.slug);
                  const disabled = !active && form.sector_slugs.length >= 5;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => toggleSector(s.slug)}
                      disabled={disabled}
                      style={{
                        padding: '8px 14px',
                        fontSize: 13,
                        letterSpacing: '0.02em',
                        background: active ? 'var(--ink-950)' : 'transparent',
                        color: active ? 'var(--gold-400)' : disabled ? 'var(--ink-300)' : 'var(--ink-950)',
                        border: `1px solid ${active ? 'var(--ink-950)' : 'var(--ivory-200)'}`,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.4 : 1,
                        transition: 'all 150ms',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs muted" style={{ marginTop: 10 }}>
                {form.sector_slugs.length} / 5 selected
              </div>
            </Field>
          </FormSection>

          {/* Action bar */}
          <div
            style={{
              marginTop: 'var(--space-8)',
              padding: 'var(--space-5)',
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 'var(--space-4)',
              alignItems: 'center',
            }}
            data-action-bar
          >
            <div>
              <div className="eyebrow">Ready to publish?</div>
              <p className="text-sm muted" style={{ margin: '6px 0 0', maxWidth: 520 }}>
                Save as a draft to keep working privately, or submit for SAREGO review. Reviewed
                projects appear in the public marketplace once approved.
              </p>
            </div>
            <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleSave}
                disabled={submitting}
              >
                <Save size={14} />
                {isEdit ? 'Save Changes' : 'Save Draft'}
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleSubmitForReview}
                disabled={submitting || !isValid}
              >
                <Send size={14} />
                Submit for Review
              </button>
            </div>
          </div>

          {submitError && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: '#fff5ee',
                border: '1px solid #f0c5a8',
                color: 'var(--rust-600)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <AlertCircle size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
              <div>{submitError}</div>
            </div>
          )}

          {savedProject && savedProject.status === 'draft' && !submitError && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: '#f0f7f0',
                border: '1px solid #c8d8c8',
                color: 'var(--sage-700)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <CheckCircle2 size={16} />
              Draft saved. You can return to refine, or submit for review when ready.
            </div>
          )}
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 640px) {
          [data-grid-2] { grid-template-columns: 1fr !important; }
          [data-action-bar] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* =================== Sub-components ==================================== */

function FormSection({ number, title, subtitle, children }) {
  return (
    <section
      style={{
        marginTop: 'var(--space-6)',
        paddingTop: 'var(--space-6)',
        borderTop: '1px solid var(--ivory-200)',
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 'var(--space-6)',
      }}
      data-form-section
    >
      <div>
        <div
          className="mono"
          style={{ fontSize: 13, letterSpacing: '0.16em', color: 'var(--gold-700)' }}
        >
          {number}
        </div>
        <h2 style={{ fontSize: 22, marginTop: 8, lineHeight: 1.2 }}>{title}</h2>
        {subtitle && (
          <p className="text-sm muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>{children}</div>

      <style>{`
        @media (max-width: 720px) {
          [data-form-section] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function Field({ label, hint, error, counter, children }) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <label className="label" style={{ marginBottom: 0 }}>{label}</label>
          {counter && (
            <span className="text-xs muted" style={{ fontFamily: 'var(--font-mono)' }}>{counter}</span>
          )}
        </div>
      )}
      {children}
      {hint && !error && (
        <div className="text-xs muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{hint}</div>
      )}
      {error && (
        <div
          className="text-xs"
          style={{ marginTop: 6, color: 'var(--rust-600)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <AlertCircle size={11} /> {error}
        </div>
      )}
    </div>
  );
}

function StageOption({ selected, onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '14px 16px',
        background: selected ? 'var(--ink-950)' : 'var(--bg-elev)',
        color: selected ? 'var(--ivory-50)' : 'var(--ink-950)',
        border: `1px solid ${selected ? 'var(--ink-950)' : 'var(--ivory-200)'}`,
        cursor: 'pointer',
        transition: 'all 150ms',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: `2px solid ${selected ? 'var(--gold-400)' : 'var(--ivory-200)'}`,
          background: selected ? 'var(--gold-400)' : 'transparent',
          flex: '0 0 auto',
        }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            marginTop: 3,
            color: selected ? 'var(--ink-300)' : 'var(--fg-muted)',
          }}
        >
          {hint}
        </div>
      </div>
    </button>
  );
}

function StatusBanner({ status }) {
  const cfg = {
    pending_review: {
      label: 'Submitted — under SAREGO review',
      body: 'You will be notified by email once a decision is made. The project cannot be edited while in review.',
      bg: '#fff8e8',
      border: '#e8d486',
      color: 'var(--gold-700)',
    },
    rejected: {
      label: 'Returned for revisions',
      body: 'A SAREGO reviewer has requested changes. Update the relevant sections and resubmit when ready.',
      bg: '#fff5ee',
      border: '#f0c5a8',
      color: 'var(--rust-600)',
    },
  }[status];
  return (
    <div
      style={{
        marginTop: 'var(--space-5)',
        padding: '14px 16px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 14 }}>{cfg.label}</div>
      <div className="text-sm" style={{ marginTop: 4, opacity: 0.85 }}>{cfg.body}</div>
    </div>
  );
}

function SuccessScreen({ project, type }) {
  const isPublished = type === 'published';
  return (
    <div style={{ background: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="light" />
      <section style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <CheckCircle2 size={48} color="var(--gold-700)" style={{ margin: '0 auto' }} strokeWidth={1.4} />
          <h1
            className="display"
            style={{ marginTop: 24, fontSize: 'clamp(32px, 4vw, 48px)' }}
          >
            {isPublished ? (
              <>Project <span style={{ fontStyle: 'italic', color: 'var(--gold-700)' }}>published.</span></>
            ) : (
              <>Submitted for <span style={{ fontStyle: 'italic', color: 'var(--gold-700)' }}>review.</span></>
            )}
          </h1>
          <p className="muted" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.6 }}>
            {isPublished
              ? `"${project.title}" is now live in the marketplace and visible to verified investors.`
              : `Your submission "${project.title}" is in the SAREGO review queue. We'll notify you by email once a decision is made — typically within 3 business days.`}
          </p>
          <div className="flex gap-3" style={{ marginTop: 36, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn btn-ghost">
              <ArrowLeft size={14} /> Return to Dashboard
            </Link>
            {isPublished && (
              <Link to={`/projects/${project.slug}`} className="btn btn-primary">
                View on Marketplace <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

/* =================== Helpers ==================================== */
function formatBackendError(err) {
  if (err.issues && Array.isArray(err.issues)) {
    return err.issues
      .map((i) => `${(i.path || []).join('.')}: ${i.message}`)
      .join(' · ');
  }
  return err.message || 'Submission failed';
}
