import { useState } from 'react';
import { createOccasion, updateOccasion } from '../../api/client';
import type { LengthType, Occasion, OccasionType, ToneType } from '../../types';

interface Props {
  contactId: number;
  occasion?: Occasion;
  onSave: (o: Occasion) => void;
  onCancel: () => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LANGUAGES = [
  { code: '', label: 'Same as contact' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

export default function OccasionForm({ contactId, occasion, onSave, onCancel }: Props) {
  const [type, setType] = useState<OccasionType>(occasion?.type ?? 'birthday');
  const [label, setLabel] = useState(occasion?.label ?? '');
  const [month, setMonth] = useState(occasion?.month ?? 1);
  const [day, setDay] = useState(occasion?.day ?? 1);
  const [year, setYear] = useState<string>(occasion?.year?.toString() ?? '');
  const [active, setActive] = useState(occasion?.active ?? true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toneOverride, setToneOverride] = useState<string>(occasion?.tone_override ?? '');
  const [languageOverride, setLanguageOverride] = useState<string>(occasion?.language_override ?? '');
  const [lengthOverride, setLengthOverride] = useState<string>(occasion?.length_override ?? '');
  const [instructionsOverride, setInstructionsOverride] = useState<string>(occasion?.custom_instructions_override ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = {
        contact_id: contactId, type, label: label || null,
        month, day, year: year ? parseInt(year) : null, active,
        tone_override: toneOverride || null,
        language_override: languageOverride || null,
        length_override: lengthOverride || null,
        custom_instructions_override: instructionsOverride || null,
      };
      const saved = occasion
        ? await updateOccasion(occasion.id, data)
        : await createOccasion(data);
      onSave(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving occasion');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={box}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
          {occasion ? 'Edit Occasion' : 'Add Occasion'}
        </h3>
        <form onSubmit={handleSubmit}>
          <label style={lbl}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as OccasionType)} style={input}>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="custom">Custom</option>
          </select>

          {type === 'custom' && (
            <>
              <label style={lbl}>Label *</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} required style={input} placeholder="e.g. Work Promotion" />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={input}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Day</label>
              <select value={day} onChange={(e) => setDay(Number(e.target.value))} style={input}>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
          </div>

          <label style={lbl}>Year (optional — enables age / years together)</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={input} placeholder="e.g. 1990" min={1900} max={2030} />

          <label style={{ ...lbl, display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>

          {/* Advanced overrides */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={advancedToggle}
          >
            {showAdvanced ? '▾' : '▸'} Override message settings for this occasion
          </button>

          {showAdvanced && (
            <div style={advancedBox}>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
                Leave blank to use the contact's default settings.
              </p>

              <label style={lbl}>Tone override</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['', 'warm', 'funny', 'formal'] as const).map((t) => (
                  <label key={t} style={radioLabel}>
                    <input
                      type="radio"
                      checked={toneOverride === t}
                      onChange={() => setToneOverride(t as ToneType | '')}
                    />
                    {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Contact default'}
                  </label>
                ))}
              </div>

              <label style={lbl}>Language override</label>
              <select value={languageOverride} onChange={(e) => setLanguageOverride(e.target.value)} style={input}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>

              <label style={lbl}>Length override</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['', 'short', 'medium', 'long'] as const).map((l) => (
                  <label key={l} style={radioLabel}>
                    <input
                      type="radio"
                      checked={lengthOverride === l}
                      onChange={() => setLengthOverride(l as LengthType | '')}
                    />
                    {l ? l.charAt(0).toUpperCase() + l.slice(1) : 'Contact default'}
                  </label>
                ))}
              </div>

              <label style={lbl}>Custom instructions override</label>
              <textarea
                value={instructionsOverride}
                onChange={(e) => setInstructionsOverride(e.target.value)}
                rows={2}
                style={{ ...input, resize: 'vertical' }}
                placeholder="e.g. Make it extra special — she's turning 30!"
              />
            </div>
          )}

          {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const box: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: 24, width: 500, maxWidth: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflow: 'auto' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, marginTop: 12, color: '#374151' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 };
const radioLabel: React.CSSProperties = { fontSize: 13, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' };
const advancedToggle: React.CSSProperties = { marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', padding: 0, textAlign: 'left' };
const advancedBox: React.CSSProperties = { marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' };
const cancelBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' };
