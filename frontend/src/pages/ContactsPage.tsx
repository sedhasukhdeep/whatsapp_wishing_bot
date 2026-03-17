import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteContact, listContacts } from '../api/client';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import type { Contact, RelationshipType } from '../types';

const RELATIONSHIPS: RelationshipType[] = ['family', 'friend', 'colleague', 'acquaintance', 'other'];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [rel, setRel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    listContacts(search, rel).then(setContacts);
  }, [search, rel]);

  async function handleDelete(c: Contact) {
    await deleteContact(c.id);
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    setConfirmDelete(null);
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={heading}>Contacts</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => nav('/contacts/import')} style={btnSecondary}>Import from Calendar</button>
          <button onClick={() => nav('/contacts/new')} style={btnPrimary}>+ Add Contact</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, minWidth: 240 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['', ...RELATIONSHIPS].map((r) => (
            <button
              key={r}
              onClick={() => setRel(r)}
              style={{ ...chipBtn, background: rel === r ? '#2563eb' : '#f3f4f6', color: rel === r ? '#fff' : '#374151' }}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </div>

      {contacts.length === 0 ? (
        <div style={emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <p style={{ fontSize: 16, fontWeight: 500, margin: '0 0 6px' }}>No contacts yet</p>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
            Add contacts manually or import from your calendar.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => nav('/contacts/import')} style={btnSecondary}>Import from Calendar</button>
            <button onClick={() => nav('/contacts/new')} style={btnPrimary}>Add Contact</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {contacts.map((c) => (
            <div key={c.id} style={card}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 8px' }}>
                {c.phone} · <span style={relBadge(c.relationship)}>{c.relationship}</span>
              </div>
              {c.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, lineHeight: 1.4 }}>{c.notes}</div>}
              {c.whatsapp_chat_id && (
                <div style={{ fontSize: 12, color: '#059669', marginBottom: 8 }}>
                  WhatsApp: {c.whatsapp_chat_name || c.whatsapp_chat_id}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => nav(`/contacts/${c.id}/edit`)} style={btnEdit}>Edit</button>
                <button onClick={() => setConfirmDelete(c)} style={btnDelete}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete ${confirmDelete.name}? This will also remove all their occasions and drafts.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function relBadge(rel: string): React.CSSProperties {
  const colors: Record<string, string> = { family: '#fef3c7', friend: '#dbeafe', colleague: '#f3e8ff', acquaintance: '#f3f4f6', other: '#f3f4f6' };
  return { background: colors[rel] || '#f3f4f6', padding: '1px 7px', borderRadius: 10, fontSize: 11 };
}

const page: React.CSSProperties = { padding: 32 };
const heading: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' };
const btnPrimary: React.CSSProperties = { padding: '9px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14 };
const btnSecondary: React.CSSProperties = { padding: '9px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 };
const chipBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13 };
const btnEdit: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnDelete: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13 };
const emptyState: React.CSSProperties = { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' };
