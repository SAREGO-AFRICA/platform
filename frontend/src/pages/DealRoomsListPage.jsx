import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Users,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const ROLE_BADGE = {
  owner: { label: 'Owner', color: 'var(--gold-700)' },
  editor: { label: 'Editor', color: 'var(--sage-700)' },
  viewer: { label: 'Viewer', color: 'var(--fg-muted)' },
};

export default function DealRoomsListPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    load();
  }, [navigate]);

  async function load() {
    try {
      setLoading(true);
      const data = await api('/api/deal-rooms');
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err.message || 'Failed to load deal rooms.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1020, margin: '0 auto', padding: '40px 24px 80px' }}>
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
          <Lock size={28} style={{ color: 'var(--gold-700)' }} />
          <h1 style={{ fontSize: 32, margin: 0 }}>Deal Rooms</h1>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Confidential workspaces where sponsors and investors share due-diligence
          documents. Each deal room is private to its members.
        </p>

        {loading ? (
          <p style={{ color: 'var(--fg-muted)', fontSize: 14 }}>Loading...</p>
        ) : error ? (
          <div
            style={{
              background: '#fdecea',
              color: 'var(--rust-600, #b00020)',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : rooms.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--border, #ccc)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              color: 'var(--fg-muted)',
            }}
          >
            <ShieldCheck size={40} style={{ color: 'var(--fg-muted)', marginBottom: 12 }} />
            <h3 style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--fg)' }}>
              No deal rooms yet
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 480, marginInline: 'auto' }}>
              When a sponsor accepts your interest in a project, or when you accept an
              investor's interest in yours, a private deal room opens here.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rooms.map((room) => {
              const badge = ROLE_BADGE[room.room_role] || ROLE_BADGE.viewer;
              return (
                <li key={room.id}>
                  <Link
                    to={`/deal-rooms/${room.id}`}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid var(--border, #e5e5e5)',
                      borderRadius: 12,
                      padding: 20,
                      background: 'var(--bg-card, #fff)',
                      transition: 'border-color 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold-700)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border, #e5e5e5)')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--fg-muted)',
                            marginBottom: 4,
                          }}
                        >
                          {room.project_title}
                        </div>
                        <div
                          style={{
                            fontSize: 17,
                            fontWeight: 500,
                            marginBottom: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {room.name}
                          <ArrowUpRight size={16} style={{ color: 'var(--fg-muted)' }} />
                        </div>
                        {room.description && (
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--fg-muted)',
                              lineHeight: 1.5,
                              maxWidth: 600,
                            }}
                          >
                            {room.description}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 18,
                          flexWrap: 'wrap',
                          fontSize: 13,
                          color: 'var(--fg-muted)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: badge.color,
                            border: `1px solid ${badge.color}`,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Users size={14} />
                          {room.member_count}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={14} />
                          {room.document_count}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
