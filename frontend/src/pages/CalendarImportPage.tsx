import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmCalendarImport, previewCalendarImport } from '../api/client';
import type { CalendarImportConfirmItem, CalendarImportPreviewItem, RelationshipType } from '../types';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarImportPage() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<CalendarImportPreviewItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [phones, setPhones] = useState<Record<number, string>>({});
  const [relationships, setRelationships] = useState<Record<number, RelationshipType>>({});
  const [result, setResult] = useState<{ contacts_created: number; occasions_created: number } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const items = await previewCalendarImport(file);
      setPreview(items);
      // Pre-select all items
      setSelected(new Set(items.map((_, i) => i)));
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse calendar file');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function handleConfirm() {
    // Validate: new contacts need a phone number
    const items = preview.filter((_, i) => selected.has(i));
    const missing = items.filter((item, i) => {
      const idx = preview.indexOf(item);
      return !item.existing_contact_id && !phones[idx]?.trim();
    });
    if (missing.length > 0) {
      setError(`Please enter phone numbers for new contacts: ${missing.map((m) => m.name).join(', ')}`);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const confirmItems: CalendarImportConfirmItem[] = items.map((item) => {
        const idx = preview.indexOf(item);
        return {
          name: item.name,
          occasion_type: item.occasion_type,
          label: item.label,
          month: item.month,
          day: item.day,
          year: item.year,
          phone: phones[idx]?.trim() || item.existing_contact_id ? phones[idx]?.trim() || '' : '',
          relationship: (relationships[idx] || 'friend') as RelationshipType,
          existing_contact_id: item.existing_contact_id,
        };
      });
      const res = await confirmCalendarImport(confirmItems);
      setResult(res);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => nav('/contacts')} style={backBtn}>← Back</button>
        <h1 style={heading}>Import from Calendar</h1>
      </div>

      {step === 'upload' && (
        <div style={section}>
          <h2 style={sectionTitle}>Upload Calendar File</h2>
          <p style={hint}>
            Export your contacts' birthdays and anniversaries from Google Calendar or Apple Calendar as an .ics file.
          </p>
          <ul style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', paddingLeft: 20 }}>
            <li><strong>Google Calendar:</strong> Settings → [Calendar] → Export calendar</li>
            <li><strong>Apple Calendar:</strong> File → Export → Export…</li>
          </ul>

          <input
            ref={fileRef}
            type="file"
            accept=".ics"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            style={btnPrimary}
          >
            {loading ? 'Parsing...' : 'Choose .ics File'}
          </button>

          {error && <p style={errStyle}>{error}</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div style={section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>
                Found {preview.length} event{preview.length !== 1 ? 's' : ''}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelected(new Set(preview.map((_, i) => i)))} style={btnGhost}>Select All</button>
                <button onClick={() => setSelected(new Set())} style={btnGhost}>Deselect All</button>
              </div>
            </div>

            <p style={hint}>
              Review and select which events to import. For new contacts, enter their phone number.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={th}></th>
                    <th style={th}>Name</th>
                    <th style={th}>Occasion</th>
                    <th style={th}>Date</th>
                    <th style={th}>Status</th>
                    <th style={th}>Phone *</th>
                    <th style={th}>Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', opacity: selected.has(idx) ? 1 : 0.45 }}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleSelect(idx)}
                        />
                      </td>
                      <td style={{ ...td, fontWeight: 500 }}>{item.name}</td>
                      <td style={td}>
                        <span style={occasionBadge(item.occasion_type)}>
                          {item.occasion_type}
                        </span>
                      </td>
                      <td style={td}>
                        {MONTHS[item.month]} {item.day}{item.year ? `, ${item.year}` : ''}
                      </td>
                      <td style={td}>
                        {item.existing_contact_id ? (
                          <span style={{ color: '#059669', fontSize: 12 }}>
                            Existing: {item.existing_contact_name}
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', fontSize: 12 }}>New contact</span>
                        )}
                      </td>
                      <td style={td}>
                        {item.existing_contact_id ? (
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                        ) : (
                          <input
                            type="text"
                            value={phones[idx] ?? ''}
                            onChange={(e) => setPhones((p) => ({ ...p, [idx]: e.target.value }))}
                            placeholder="+919876543210"
                            style={{ ...cellInput, borderColor: selected.has(idx) && !phones[idx]?.trim() ? '#fca5a5' : '#d1d5db' }}
                          />
                        )}
                      </td>
                      <td style={td}>
                        {item.existing_contact_id ? (
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                        ) : (
                          <select
                            value={relationships[idx] ?? 'friend'}
                            onChange={(e) => setRelationships((r) => ({ ...r, [idx]: e.target.value as RelationshipType }))}
                            style={cellInput}
                          >
                            <option value="family">Family</option>
                            <option value="friend">Friend</option>
                            <option value="colleague">Colleague</option>
                            <option value="acquaintance">Acquaintance</option>
                            <option value="other">Other</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p style={errStyle}>{error}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { setStep('upload'); setPreview([]); }} style={btnCancel}>Back</button>
            <button
              onClick={handleConfirm}
              disabled={loading || selected.size === 0}
              style={{ ...btnPrimary, opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              {loading ? 'Importing...' : `Import ${selected.size} event${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <div style={{ ...section, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Import Complete</h2>
          <p style={{ color: '#6b7280', margin: '0 0 24px' }}>
            Created {result.contacts_created} new contact{result.contacts_created !== 1 ? 's' : ''} and{' '}
            {result.occasions_created} occasion{result.occasions_created !== 1 ? 's' : ''}.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => nav('/contacts')} style={btnPrimary}>View Contacts</button>
            <button onClick={() => { setStep('upload'); setPreview([]); setResult(null); }} style={btnGhost}>Import More</button>
          </div>
        </div>
      )}
    </div>
  );
}

function occasionBadge(type: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    birthday: { bg: '#fef3c7', color: '#92400e' },
    anniversary: { bg: '#fce7f3', color: '#9d174d' },
    custom: { bg: '#e0e7ff', color: '#3730a3' },
  };
  const c = colors[type] || colors.custom;
  return { background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500 };
}

const page: React.CSSProperties = { padding: 32, maxWidth: 1000, margin: '0 auto' };
const heading: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0, color: '#111827' };
const section: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, marginBottom: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#374151' };
const hint: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, color: '#6b7280' };
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, color: '#374151', fontSize: 13 };
const td: React.CSSProperties = { padding: '8px 10px' };
const cellInput: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, width: '100%', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14 };
const btnGhost: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnCancel: React.CSSProperties = { padding: '10px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 };
const backBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' };
const errStyle: React.CSSProperties = { color: '#dc2626', fontSize: 13, marginTop: 8 };
