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

export default function KycPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState('passport');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    setError(null);
    setSuccess(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('File is larger than 10 MB.');
      setFile(null);
      return;
    }
    if (!ALLOWED_MIME.includes(selected.type)) {
      setError('Unsupported file type. Use PDF, JPEG, PNG, or WebP.');
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const token = getAccessToken();
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

      setSuccess('Document submitted. SAREGO compliance will review it shortly.');
      setFile(null);
      const fileInput = document.getElementById('kyc-file-input');
      if (fileInput) fileInput.value = '';
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  }

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
          Files must be PDF, JPEG, PNG, or WebP, and under 10 MB each.
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
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 18 }}>Upload a document</h2>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Document type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid var(--border, #ccc)',
                marginBottom: 18,
                background: '#fff',
              }}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              File
            </label>
            <input
              id="kyc-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid var(--border, #ccc)',
                marginBottom: 18,
                background: '#fff',
              }}
            />

            {error && (
              <div
                style={{
                  background: '#fdecea',
                  color: 'var(--rust-600, #b00020)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  background: '#e6f4ea',
                  color: 'var(--sage-700, #1e6b3a)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !file}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                opacity: submitting || !file ? 0.6 : 1,
                cursor: submitting || !file ? 'not-allowed' : 'pointer',
              }}
            >
              <Upload size={14} />
              {submitting ? 'Uploading...' : 'Submit document'}
            </button>
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
      </main>
      <Footer />
    </>
  );
}