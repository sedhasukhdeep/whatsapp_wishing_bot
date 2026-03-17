import { useEffect, useRef, useState } from 'react';
import { createTarget, deleteTarget, getBridgeStatus, getWaChats, listTargets, updateTarget, type WaChat } from '../api/client';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import type { BridgeStatus, TargetType, WhatsAppTarget } from '../types';

interface TargetFormState {
  name: string;
  chat_id: string;
  target_type: TargetType;
  description: string;
}

const EMPTY_FORM: TargetFormState = { name: '', chat_id: '', target_type: 'individual', description: '' };

export default function TargetsPage() {
  const [targets, setTargets] = useState<WhatsAppTarget[]>([]);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [waChats, setWaChats] = useState<WaChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsAppTarget | null>(null);
  const [form, setForm] = useState<TargetFormState>(EMPTY_FORM);
  const [chatSearch, setChatSearch] = useState('');
  const [showChatPicker, setShowChatPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [t, s] = await Promise.all([listTargets(), getBridgeStatus()]);
    setTargets(t);
    setStatus(s);
  }

  useEffect(() => { load(); }, []);

  async function loadChats() {
    setChatsLoading(true);
    setChatsError('');
    try {
      const chats = await getWaChats();
      setWaChats(chats);
    } catch {
      setChatsError('Could not load chats — make sure WhatsApp is connected.');
    } finally {
      setChatsLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setChatSearch('');
    setShowChatPicker(false);
    setShowForm(true);
    loadChats();
  }

  function openEdit(t: WhatsAppTarget) {
    setForm({ name: t.name, chat_id: t.chat_id, target_type: t.target_type, description: t.description ?? '' });
    setEditTarget(t);
    setChatSearch('');
    setShowChatPicker(false);
    setShowForm(true);
    loadChats();
  }

  function selectChat(chat: WaChat) {
    setForm((f) => ({ ...f, chat_id: chat.id, target_type: chat.type, name: f.name || chat.name }));
    setShowChatPicker(false);
    setChatSearch('');
  }

  const filteredChats = waChats.filter((c) =>
    c.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
    c.id.includes(chatSearch)
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = { ...form, description: form.description || null };
      if (editTarget) {
        const updated = await updateTarget(editTarget.id, data);
        setTargets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      } else {
        const created = await createTarget(data);
        setTargets((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch {
      setError('Error saving target');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: WhatsAppTarget) {
    await deleteTarget(t.id);
    setTargets((prev) => prev.filter((x) => x.id !== t.id));
    setConfirmDelete(null);
  }

  return (
    <div style={page}>
      <h1 style={heading}>WhatsApp Targets</h1>

      {/* Bridge status */}
      <div style={statusCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: status?.qr_image ? 16 : 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: status?.ready ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            WhatsApp: {status?.ready ? 'Connected' : 'Not connected — scan QR to link your phone'}
          </span>
          <button onClick={load} style={refreshBtn}>Refresh</button>
        </div>
        {status?.qr_image && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>
              Open WhatsApp → Settings → Linked Devices → Link a Device → scan below
            </p>
            <img src={status.qr_image} alt="WhatsApp QR" style={{ width: 180, height: 180, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Send Targets</h2>
        <button onClick={openAdd} style={btnPrimary}>+ Add Target</button>
      </div>

      {targets.length === 0
        ? <p style={{ color: '#9ca3af', fontSize: 14 }}>No targets yet. Add one to send messages.</p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={th}>Name</th><th style={th}>Type</th><th style={th}>Chat ID</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={td}><strong>{t.name}</strong>{t.description && <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>{t.description}</span>}</td>
                  <td style={td}><span style={{ ...typeBadge, background: t.target_type === 'group' ? '#dbeafe' : '#d1fae5', color: t.target_type === 'group' ? '#1d4ed8' : '#065f46' }}>{t.target_type}</span></td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{t.chat_id}</td>
                  <td style={td}>
                    <button onClick={() => openEdit(t)} style={btnEditSm}>Edit</button>{' '}
                    <button onClick={() => setConfirmDelete(t)} style={btnDeleteSm}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {/* Add/Edit modal */}
      {showForm && (
        <div style={overlay}>
          <div style={formBox}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{editTarget ? 'Edit Target' : 'Add Target'}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              {status?.ready
                ? 'Select a chat from your WhatsApp to link it as a send target.'
                : 'Connect WhatsApp first to pick chats automatically.'}
            </p>

            <form onSubmit={handleSave}>
              {/* Chat picker */}
              <label style={lbl}>WhatsApp Chat *</label>
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => { setShowChatPicker((v) => !v); setTimeout(() => searchRef.current?.focus(), 50); }}
                  style={{ ...input, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                >
                  <span style={{ color: form.chat_id ? '#111827' : '#9ca3af' }}>
                    {form.chat_id
                      ? (waChats.find((c) => c.id === form.chat_id)?.name || form.chat_id)
                      : 'Select a chat...'}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>▼</span>
                </div>

                {showChatPicker && (
                  <div style={dropdown}>
                    <input
                      ref={searchRef}
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search by name..."
                      style={{ ...input, margin: '8px', width: 'calc(100% - 16px)', boxSizing: 'border-box' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {chatsLoading && <div style={dropItem}>Loading chats...</div>}
                    {chatsError && <div style={{ ...dropItem, color: '#dc2626' }}>{chatsError}</div>}
                    {!chatsLoading && !chatsError && filteredChats.length === 0 && (
                      <div style={dropItem}>No chats found</div>
                    )}
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => selectChat(chat)}
                          style={{ ...dropItem, background: form.chat_id === chat.id ? '#eff6ff' : '#fff' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 500 }}>{chat.name}</span>
                            <span style={{ ...typeBadge, fontSize: 11, background: chat.type === 'group' ? '#dbeafe' : '#d1fae5', color: chat.type === 'group' ? '#1d4ed8' : '#065f46' }}>
                              {chat.type}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{chat.id}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label style={lbl}>Label *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                style={input}
                placeholder="e.g. Family Group, Wifey"
              />

              <label style={lbl}>Description (optional)</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={input}
                placeholder="e.g. For birthday wishes only"
              />

              {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving || !form.chat_id} style={{ ...saveBtn, opacity: form.chat_id ? 1 : 0.5 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete target "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: 32 };
const heading: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: '0 0 20px', color: '#111827' };
const statusCard: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 };
const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14 };
const refreshBtn: React.CSSProperties = { padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12 };
const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, color: '#374151' };
const td: React.CSSProperties = { padding: '10px 14px', color: '#4b5563' };
const typeBadge: React.CSSProperties = { padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 };
const btnEditSm: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' };
const btnDeleteSm: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer', background: '#fee2e2', color: '#dc2626' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const formBox: React.CSSProperties = { background: '#fff', borderRadius: 8, padding: 24, width: 500, maxWidth: '95%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, marginTop: 12, color: '#374151' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff' };
const dropdown: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, marginTop: 4 };
const dropItem: React.CSSProperties = { padding: '10px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' };
const cancelBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' };
