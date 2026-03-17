import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createContact, deleteOccasion, getContact, updateContact } from '../api/client';
import ChatPicker from '../components/contacts/ChatPicker';
import OccasionForm from '../components/contacts/OccasionForm';
import type { ContactWithOccasions, LengthType, Occasion, RelationshipType, ToneType } from '../types';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TONES: { value: ToneType; label: string; desc: string }[] = [
  { value: 'warm', label: 'Warm', desc: 'Heartfelt and caring' },
  { value: 'funny', label: 'Funny', desc: 'Lighthearted with humor' },
  { value: 'formal', label: 'Formal', desc: 'Polite and professional' },
];

export default function ContactFormPage() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('friend');
  const [notes, setNotes] = useState('');
  const [tone, setTone] = useState<ToneType>('warm');
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState<LengthType>('medium');
  const [customInstructions, setCustomInstructions] = useState('');
  const [whatsappChatId, setWhatsappChatId] = useState<string | null>(null);
  const [whatsappChatName, setWhatsappChatName] = useState<string | null>(null);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [showOccasionForm, setShowOccasionForm] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<Occasion | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getContact(Number(id)).then((c: ContactWithOccasions) => {
        setName(c.name); setPhone(c.phone); setRelationship(c.relationship);
        setNotes(c.notes ?? ''); setTone(c.tone_preference); setLanguage(c.language);
        setLength(c.message_length); setCustomInstructions(c.custom_instructions ?? '');
        setWhatsappChatId(c.whatsapp_chat_id);
        setWhatsappChatName(c.whatsapp_chat_name);
        setOccasions(c.occasions);
        // Auto-switch to advanced if non-default values exist
        if (c.language !== 'en' || c.message_length !== 'medium' || c.custom_instructions) {
          setAdvancedMode(true);
        }
      });
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = {
        name, phone, relationship,
        notes: notes || null,
        tone_preference: tone,
        language,
        message_length: length,
        custom_instructions: customInstructions || null,
        whatsapp_chat_id: whatsappChatId,
        whatsapp_chat_name: whatsappChatName,
      };
      if (isEdit) {
        await updateContact(Number(id), data);
      } else {
        await createContact(data);
      }
      nav('/contacts');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving contact');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOccasion(occ: Occasion) {
    await deleteOccasion(occ.id);
    setOccasions((prev) => prev.filter((o) => o.id !== occ.id));
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button type="button" onClick={() => nav('/contacts')} style={backBtn}>← Back</button>
        <h1 style={heading}>{isEdit ? 'Edit Contact' : 'Add Contact'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <section style={section}>
          <h2 style={sectionTitle}>Basic Info</h2>

          <label style={lbl}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required style={input} placeholder="e.g. Priya Sharma" />

          <label style={lbl}>Phone * (international format)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required style={input} placeholder="+919876543210" />

          <label style={lbl}>Relationship</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {(['family', 'friend', 'colleague', 'acquaintance', 'other'] as RelationshipType[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelationship(r)}
                style={{ ...chipBtn, background: relationship === r ? '#2563eb' : '#f3f4f6', color: relationship === r ? '#fff' : '#374151' }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <label style={lbl}>Personal Notes (used by AI to personalize messages)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...input, resize: 'vertical' }}
            placeholder="e.g. loves cricket, has two kids named Arjun and Priya, big Arsenal fan..."
          />
        </section>

        {/* WhatsApp Chat */}
        <section style={section}>
          <h2 style={sectionTitle}>WhatsApp Chat</h2>
          <p style={hint}>Link this contact to a WhatsApp chat so messages can be sent with one click.</p>
          <ChatPicker
            chatId={whatsappChatId}
            chatName={whatsappChatName}
            onChange={(cid, cname) => { setWhatsappChatId(cid); setWhatsappChatName(cname); }}
          />
        </section>

        {/* Message Preferences */}
        <section style={section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Message Preferences</h2>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setAdvancedMode(false)}
                style={{ ...modeBtn, background: !advancedMode ? '#2563eb' : '#fff', color: !advancedMode ? '#fff' : '#374151' }}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setAdvancedMode(true)}
                style={{ ...modeBtn, background: advancedMode ? '#2563eb' : '#fff', color: advancedMode ? '#fff' : '#374151' }}
              >
                Advanced
              </button>
            </div>
          </div>

          <label style={lbl}>Tone</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 4 }}>
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                style={{
                  ...toneCard,
                  border: tone === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  background: tone === t.value ? '#eff6ff' : '#fff',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {advancedMode && (
            <>
              <label style={lbl}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={input}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>

              <label style={lbl}>Message Length</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['short', 'medium', 'long'] as LengthType[]).map((l) => (
                  <label key={l} style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" checked={length === l} onChange={() => setLength(l)} />
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </label>
                ))}
              </div>

              <label style={lbl}>Custom AI Instructions (optional)</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
                style={{ ...input, resize: 'vertical' }}
                placeholder="e.g. Always end with a Punjabi phrase. Mention their pet dog Bruno."
              />
            </>
          )}
        </section>

        {/* Occasions — only available after contact is created */}
        {isEdit && (
          <section style={section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Occasions</h2>
              <button
                type="button"
                onClick={() => { setEditingOccasion(undefined); setShowOccasionForm(true); }}
                style={btnAdd}
              >
                + Add Occasion
              </button>
            </div>
            {occasions.length === 0
              ? <p style={{ color: '#9ca3af', fontSize: 14 }}>No occasions yet.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={th}>Type</th>
                      <th style={th}>Date</th>
                      <th style={th}>Year</th>
                      <th style={th}>Active</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {occasions.map((occ) => (
                      <tr key={occ.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td}>{occ.label || occ.type}</td>
                        <td style={td}>{MONTHS[occ.month]} {occ.day}</td>
                        <td style={td}>{occ.year ?? '—'}</td>
                        <td style={td}>{occ.active ? 'Yes' : 'No'}</td>
                        <td style={td}>
                          <button type="button" onClick={() => { setEditingOccasion(occ); setShowOccasionForm(true); }} style={btnEditSm}>Edit</button>
                          {' '}
                          <button type="button" onClick={() => handleDeleteOccasion(occ)} style={btnDeleteSm}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>
        )}

        {!isEdit && (
          <div style={{ ...section, background: '#f0f9ff', borderColor: '#bae6fd' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#0369a1' }}>
              Save the contact first, then you can add their occasions (birthdays, anniversaries, etc.) from the edit screen.
            </p>
          </div>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" onClick={() => nav('/contacts')} style={btnCancel}>Cancel</button>
          <button type="submit" disabled={saving} style={btnSave}>{saving ? 'Saving...' : 'Save Contact'}</button>
        </div>
      </form>

      {showOccasionForm && (
        <OccasionForm
          contactId={Number(id)}
          occasion={editingOccasion}
          onSave={(saved) => {
            setOccasions((prev) => {
              const idx = prev.findIndex((o) => o.id === saved.id);
              return idx >= 0 ? prev.map((o) => o.id === saved.id ? saved : o) : [...prev, saved];
            });
            setShowOccasionForm(false);
          }}
          onCancel={() => setShowOccasionForm(false)}
        />
      )}
    </div>
  );
}

const page: React.CSSProperties = { padding: 32, maxWidth: 700, margin: '0 auto' };
const heading: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0, color: '#111827' };
const section: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#374151' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, marginTop: 12, color: '#374151' };
const hint: React.CSSProperties = { margin: '0 0 10px', fontSize: 13, color: '#6b7280' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 };
const chipBtn: React.CSSProperties = { padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const modeBtn: React.CSSProperties = { padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const toneCard: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px' };
const btnAdd: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: '1px solid #2563eb', color: '#2563eb', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnEditSm: React.CSSProperties = { padding: '3px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' };
const btnDeleteSm: React.CSSProperties = { padding: '3px 8px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer', background: '#fee2e2', color: '#dc2626' };
const backBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' };
const btnCancel: React.CSSProperties = { padding: '10px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' };
const btnSave: React.CSSProperties = { padding: '10px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 };
