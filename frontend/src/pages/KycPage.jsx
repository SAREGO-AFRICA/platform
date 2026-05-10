import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Loader2,
  X,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's Licence" },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'incorporation', label: 'Certificate of Incorporation' },
  { value: 'tax_cert', label: 'Tax Certificate' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'directors_id', label: "Director's ID" },
];

const STATUS_META = {
  pending: { label: 'In Review', color: 'var(--gold-700)', Icon: Clock },
  approved: { label: 'Approved', color: 'var(--sage-700)', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'var(--rust-600)', Icon: XCircle },
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Per-row upload status: 'idle' | 'uploading' | 'success' | 'error'
const initialSlots = () =>
  DOCUMENT_TYPES.map((d) => ({
    type: d.value,
    label: d.label,
    file: null,
    status: 'idle',
    message: null,
  }));

export default function KycPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState(initialSlots);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [globalSuccess, setGlobalSuccess] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    loadDocuments();
  }, [navigate]);

  async function loadDocuments() {
    try {
      setLoading(true);
      const data = await api('/api/kyc/mine');
      setDocuments(data.documents || []);
    } catch (err) {
      setGlobalError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(slotIndex, fileList) {
    const selected = fileList?.[0];
    setGlobalError(null);
    setGlobalSuccess(null);

    if (!selected) {
      updateSlot(slotIndex, { file: null, status: 'idle', message: null });
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      updateSlot(slotIndex, {
        file: null,
        status: 'error',
        message: 'File is larger than 10 MB.',
      });
      return;
    }
    if (!ALLOWED_MIME.includes(selected.type)) {
      updateSlot(slotIndex, {
        file: null,
        status: 'error',
        message: 'Use PDF, JPEG, PNG, or WebP.',
      });
      return;
    }
    updateSlot(slotIndex, { file: selected, status: 'idle', message: null });
  }

  function clearSlot(slotIndex) {
    updateSlot(slotIndex, { file: null, status: 'idle', message: null });
    const input = document.getElementById(`kyc-file-${slotIndex}`);
    if (input) input.value = '';
  }

  function updateSlot(slotIndex, patch) {
    setSlots((prev) =>
      prev.map((s, i) => (i === slotIndex ? { ...s, ...patch } : s))
    );
  }

  async function uploadOne(slotIndex) {
    const slot = slots[slotIndex];
    if (!slot.file) return { ok: true, skipped: true };

    updateSlot(slotIndex, { status: 'uploading', message: null });

    const formData = new FormData();
    formData.append('file', slot.file);
    formData.append('document_type', slot.type);

    const token = getAccessToken();
    try {
      const res = await fetch(`${BASE_URL}/api/kyc/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let msg = `Upload failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      updateSlot(slotIndex, {
        status: 'success',
        message: 'Submitted',
      });
      return { ok: true };
    } catch (err) {
      updateSlot(slotIndex, {
        status: 'error',
        message: err.message || 'Upload failed.',
      });
      return { ok: false };
    }
  }

  async function handleSubmitAll(e) {
    e.preventDefault();
    const withFiles = slots
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => s.file);

    if (withFiles.length === 0) {
      setGlobalError('Please choose at least one document to upload.');
      return;
    }

    setGlobalError(null);
    setGlobalSuccess(null);
    setSubmitting(true);

    let successCount = 0;
    let failCount = 0;

    for (const slot of withFiles) {
      const result = await uploadOne(slot.index);
      if (result.ok && !result.skipped) successCount += 1;
      else if (!result.ok) failCount += 1;
    }

    setSubmitting(false);

    if (successCount > 0 && failCount === 0) {
      setGlobalSuccess(
        `${successCount} document${successCount === 1 ? '' : 's'} submitted. SAREGO compliance will review shortly.`
      );
    } else if (successCount > 0 && failCount > 0) {
      setGlobalError(
        `${successCount} succeeded, ${failCount} failed. See errors next to each document.`
      );
    } else if (failCount > 0) {
      setGlobalError('Upload failed. See errors next to each document.');
    }

    // Clear successfully uploaded files from inputs and refresh list
    setSlots((prev) =>
      prev.map((s, i) => {
        if (s.status === 'success') {
          const input = document.getElementById(`kyc-file-${i}`);
          if (input) input.value = '';
          return { ...s, file: null };
        }
        return s;
      })
    );
    await loadDocuments();
  }

  const selectedCount = slots.filter((s) => s.file).length;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--fg-muted)',
            textDecoration: 'none',
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <ShieldCheck size={28} style={{ color: 'var(--sage-700)' }} />
          <h1 style={{ fontSize: 32, margin: 0 }}>KYC Verification</h1>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Submit identity and organisation documents to unlock the marketplace.
          Choose any documents you want to submit below, then click Submit at the
          bottom. Files must be PDF, JPEG, PNG, or WebP, and under 10 MB each.
        </p>

        <section
          style={{
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border, #e5e5e5)',
            borderRadius: 12,
            padding: 28,
            marginBottom: 32,
          }}
        >
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 18 }}>Upload documents</h2>

          <form onSubmit={handleSubmitAll}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {slots.map((slot, idx) => (
                <DocumentSlot
                  key={slot.type}
                  slot={slot}
                  index={idx}
                  disabled={submitting}
                  onFileChange={(files) => handleFileChange(idx, files)}
                  onClear={() => clearSlot(idx)}
                />
              ))}
            </div>

            {globalError && (
              <div
                style={{
                  background: '#fdecea',
                  color: 'var(--rust-600, #b00020)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginTop: 18,
                }}
              >
                {globalError}
              </div>
            )}
            {globalSuccess && (
              <div
                style={{
                  background: '#e6f4ea',
                  color: 'var(--sage-700, #1e6b3a)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginTop: 18,
                }}
              >
                {globalSuccess}
              </div>
            )}

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                {selectedCount === 0
                  ? 'No files selected.'
                  : `${selectedCount} file${selectedCount === 1 ? '' : 's'} ready to upload.`}
              </span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || selectedCount === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  opacity: submitting || selectedCount === 0 ? 0.6 : 1,
                  cursor:
                    submitting || selectedCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                {submitting
                  ? 'Uploading...'
                  : `Submit ${selectedCount || ''} document${selectedCount === 1 ? '' : 's'}`.trim()}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Your submitted documents</h2>
          {loading ? (
            <p style={{ color: 'var(--fg-muted)', fontSize: 14 }}>Loading...</p>
          ) : documents.length === 0 ? (
            <p style={{ color: 'var(--fg-muted)', fontSize: 14 }}>
              No documents submitted yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {documents.map((doc) => {
                const meta = STATUS_META[doc.status] || STATUS_META.pending;
                const Icon = meta.Icon;
                const typeLabel =
                  DOCUMENT_TYPES.find((d) => d.value === doc.document_type)?.label ||
                  doc.document_type;
                return (
                  <li
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      border: '1px solid var(--border, #e5e5e5)',
                      borderRadius: 8,
                      marginBottom: 10,
                      background: 'var(--bg-card, #fff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FileText size={18} style={{ color: 'var(--fg-muted)' }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{typeLabel}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                          Submitted {new Date(doc.created_at).toLocaleDateString()}
                          {doc.review_notes ? ` -- ${doc.review_notes}` : ''}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: meta.color,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <Icon size={14} />
                      {meta.label}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <style>{`
          .spin { animation: kyc-spin 1s linear infinite; }
          @keyframes kyc-spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
      <Footer />
    </>
  );
}

function DocumentSlot({ slot, index, disabled, onFileChange, onClear }) {
  const isUploading = slot.status === 'uploading';
  const isSuccess = slot.status === 'success';
  const isError = slot.status === 'error';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: isSuccess
          ? 'rgba(30, 107, 58, 0.06)'
          : isError
          ? 'rgba(176, 0, 32, 0.05)'
          : 'var(--bg-subtle, #fafafa)',
        border: `1px solid ${
          isSuccess
            ? 'rgba(30, 107, 58, 0.3)'
            : isError
            ? 'rgba(176, 0, 32, 0.3)'
            : 'var(--border, #e5e5e5)'
        }`,
        borderRadius: 8,
      }}
    >
      <label
        htmlFor={`kyc-file-${index}`}
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {slot.label}
      </label>

      <div style={{ minWidth: 0 }}>
        <input
          id={`kyc-file-${index}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => onFileChange(e.target.files)}
          disabled={disabled || isUploading || isSuccess}
          style={{
            width: '100%',
            fontSize: 13,
            padding: '6px 8px',
            background: '#fff',
            border: '1px solid var(--border, #ccc)',
            borderRadius: 6,
          }}
        />
        {slot.message && (
          <div
            style={{
              fontSize: 12,
              marginTop: 4,
              color: isSuccess
                ? 'var(--sage-700, #1e6b3a)'
                : isError
                ? 'var(--rust-600, #b00020)'
                : 'var(--fg-muted)',
            }}
          >
            {slot.message}
          </div>
        )}
      </div>

      <div
        style={{
          width: 24,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isUploading && <Loader2 size={16} className="spin" style={{ color: 'var(--fg-muted)' }} />}
        {isSuccess && <CheckCircle2 size={16} style={{ color: 'var(--sage-700)' }} />}
        {isError && <XCircle size={16} style={{ color: 'var(--rust-600)' }} />}
        {slot.file && slot.status === 'idle' && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label={`Remove ${slot.label}`}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: 'var(--fg-muted)',
              display: 'inline-flex',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          [data-kyc-slot] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
