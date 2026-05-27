// ============================================================
// ExpressInterestModal.jsx
// Session I Phase 2: institutional Express Interest modal.
//
// Two modes:
//   - Create mode: user has no existing interest. POST creates a new row.
//   - Edit mode: user already expressed interest (status === 'expressed').
//                PATCH updates the existing row.
//
// Progressive disclosure pattern:
//   - Message field visible by default
//   - "Add indicative terms (optional)" toggle reveals 4 structured fields
//
// All fields optional. Submitting an empty modal is equivalent to the old
// one-click Express Interest behavior — preserves liquidity / response velocity.
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { api } from '../lib/api';

// ============================================================
// Helpers
// ============================================================
function fmtUSD(n) {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(num)) return '';
  return num.toLocaleString();
}

function stripCommas(s) {
  return (s || '').replace(/[,$\s]/g, '');
}

// ============================================================
// Field row
// ============================================================
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 5,
      }}>
        {label}
        {hint && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  background: 'rgba(11,13,16,0.7)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

// ============================================================
// Main Modal
// ============================================================
export default function ExpressInterestModal({
  open,
  mode,          // 'create' | 'edit'
  opportunityType,
  opportunityId,
  existingInterest, // { message, indicative_amount, indicative_rate_range, indicative_tenor, conditions } - null in create mode
  onClose,
  onSuccess,     // (result) => void; called after successful POST/PATCH
}) {
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [rateRange, setRateRange] = useState('');
  const [tenor, setTenor] = useState('');
  const [conditions, setConditions] = useState('');
  const [showStructured, setShowStructured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when modal opens; pre-fill if editing
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && existingInterest) {
      setMessage(existingInterest.message || '');
      setAmount(existingInterest.indicative_amount != null ? String(existingInterest.indicative_amount) : '');
      setRateRange(existingInterest.indicative_rate_range || '');
      setTenor(existingInterest.indicative_tenor || '');
      setConditions(existingInterest.conditions || '');
      // Auto-expand structured section if any fields are populated
      const hasStructured = existingInterest.indicative_amount != null
        || existingInterest.indicative_rate_range
        || existingInterest.indicative_tenor
        || existingInterest.conditions;
      setShowStructured(!!hasStructured);
    } else {
      setMessage('');
      setAmount('');
      setRateRange('');
      setTenor('');
      setConditions('');
      setShowStructured(false);
    }
    setError(null);
  }, [open, mode, existingInterest]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // Build body — only include non-empty fields
      const body = {};
      if (message.trim())     body.message = message.trim();
      if (amount.trim())      {
        const numeric = Number(stripCommas(amount));
        if (Number.isNaN(numeric) || numeric < 0) {
          throw new Error('Amount must be a non-negative number.');
        }
        body.indicative_amount = numeric;
      }
      if (rateRange.trim())   body.indicative_rate_range = rateRange.trim();
      if (tenor.trim())       body.indicative_tenor = tenor.trim();
      if (conditions.trim())  body.conditions = conditions.trim();

      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const result = await api(`/api/opportunities/${opportunityType}/${opportunityId}/interest`, {
        method,
        body: JSON.stringify(body),
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      const msg = err.message || `Could not ${mode === 'edit' ? 'update' : 'submit'} your interest.`;
      if (msg.includes('403') || msg.toLowerCase().includes('verified')) {
        setError('Verified KYC status is required to express interest. Complete KYC to continue.');
      } else if (msg.includes('403') && mode === 'edit') {
        setError('You can no longer edit your indicative terms — the owner has progressed your interest.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const title = mode === 'edit' ? 'Update Your Expression of Interest' : 'Express Interest in Opportunity';
  const submitLabel = submitting
    ? (mode === 'edit' ? 'Updating…' : 'Submitting…')
    : (mode === 'edit' ? 'Update' : 'Submit');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161a1f',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 0,
              maxWidth: 580,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'var(--gold-400, #f4bf4c)',
                  marginBottom: 4,
                }}>
                  {mode === 'edit' ? 'Edit Submission' : 'New Submission'}
                </div>
                <h3 style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#fff',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: -0.2,
                }}>
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div style={{
              padding: 24,
              overflowY: 'auto',
              flex: 1,
            }}>
              {/* Message field */}
              <Field label="Message" hint="(optional)">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a brief note for the listing owner…"
                  rows={3}
                  maxLength={2000}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>

              {/* Collapsible structured section */}
              <button
                type="button"
                onClick={() => setShowStructured((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 0',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--gold-400, #f4bf4c)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginTop: 6,
                  marginBottom: 4,
                }}
              >
                <FileText size={14} />
                Add indicative terms (optional)
                {showStructured ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <AnimatePresence initial={false}>
                {showStructured && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      padding: 16,
                      background: 'rgba(244, 191, 76, 0.04)',
                      border: '1px solid rgba(244, 191, 76, 0.15)',
                      borderRadius: 8,
                      marginTop: 8,
                      marginBottom: 8,
                    }}>
                      <p style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.55)',
                        margin: '0 0 14px',
                        lineHeight: 1.5,
                      }}>
                        Provide indicative terms to help the listing owner evaluate your interest. All fields are optional and private — visible only to the listing owner.
                      </p>

                      <Field label="Amount (USD)" hint="(optional)">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amount ? fmtUSD(stripCommas(amount)) : ''}
                          onChange={(e) => {
                            const v = stripCommas(e.target.value);
                            if (v === '' || /^\d+(\.\d{0,2})?$/.test(v)) {
                              setAmount(v);
                            }
                          }}
                          placeholder="e.g. 1,500,000"
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Rate" hint="(optional)">
                        <input
                          type="text"
                          value={rateRange}
                          onChange={(e) => setRateRange(e.target.value)}
                          placeholder="e.g. SOFR + 450bps"
                          maxLength={120}
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Tenor" hint="(optional)">
                        <input
                          type="text"
                          value={tenor}
                          onChange={(e) => setTenor(e.target.value)}
                          placeholder="e.g. 90 days, 18 months"
                          maxLength={120}
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Conditions" hint="(optional)">
                        <textarea
                          value={conditions}
                          onChange={(e) => setConditions(e.target.value)}
                          placeholder="e.g. Subject to KYC, security on receivables, etc."
                          rows={3}
                          maxLength={2000}
                          style={{ ...inputStyle, resize: 'vertical', marginBottom: 0 }}
                        />
                      </Field>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'rgba(201,123,123,0.1)',
                  border: '1px solid rgba(201,123,123,0.3)',
                  color: '#e2a4a4',
                  fontSize: 12,
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                  <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {error}
                    {error.toLowerCase().includes('kyc') && (
                      <Link to="/kyc" style={{ color: '#e2a4a4', textDecoration: 'underline', marginLeft: 4 }}>
                        Open KYC →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '9px 16px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-gold"
                style={{
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
