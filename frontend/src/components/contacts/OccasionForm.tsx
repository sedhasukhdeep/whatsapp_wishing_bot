import { useRef, useState } from 'react';
import { createOccasion, updateOccasion } from '../../api/client';
import type { LengthType, Occasion, OccasionType, ToneType } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  contactId: number;
  occasion?: Occasion;
  onSave: (o: Occasion) => void;
  onCancel: () => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// '_default' is a sentinel meaning "same as contact" — converted to null before saving.
// Radix UI's Select does not allow empty-string values on SelectItem.
const LANGUAGES = [
  { code: '_default', label: 'Same as contact' },
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
  const advancedRef = useRef<HTMLDivElement>(null);
  const [toneOverride, setToneOverride] = useState<string>(occasion?.tone_override ?? '');
  const [languageOverride, setLanguageOverride] = useState<string>(occasion?.language_override || '_default');
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
        language_override: (languageOverride && languageOverride !== '_default') ? languageOverride : null,
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
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]" data-testid="occasion-modal">
        <DialogHeader>
          <DialogTitle>{occasion ? 'Edit Occasion' : 'Add Occasion'}</DialogTitle>
        </DialogHeader>

        <form id="occasion-form" onSubmit={handleSubmit} className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as OccasionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'custom' && (
            <div>
              <label className="block text-sm font-medium mb-1">Label *</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Work Promotion" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Month</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Day</label>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Year (optional — enables age / years together)</label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1990" min={1900} max={2030} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
            Active
          </label>

          {/* Advanced overrides toggle */}
          <button
            type="button"
            onClick={() => {
              setShowAdvanced((v) => {
                const next = !v;
                if (next) {
                  // Scroll the advanced section into view after React renders it
                  setTimeout(() => advancedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                }
                return next;
              });
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Override message settings for this occasion
          </button>

          {showAdvanced && (
            <div ref={advancedRef} className="space-y-3 p-3 bg-muted/30 rounded-lg border">
              <p className="text-xs text-muted-foreground">Leave blank to use the contact's default settings.</p>

              <div>
                <label className="block text-sm font-medium mb-1">Tone override</label>
                <div className="flex flex-wrap gap-3">
                  {(['', 'warm', 'funny', 'formal'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={toneOverride === t}
                        onChange={() => setToneOverride(t as ToneType | '')}
                      />
                      {t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Default'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Language override</label>
                <Select value={languageOverride} onValueChange={setLanguageOverride}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Length override</label>
                <div className="flex flex-wrap gap-3">
                  {(['', 'short', 'medium', 'long'] as const).map((l) => (
                    <label key={l} className={cn('flex items-center gap-1.5 text-sm cursor-pointer')}>
                      <input
                        type="radio"
                        checked={lengthOverride === l}
                        onChange={() => setLengthOverride(l as LengthType | '')}
                      />
                      {l ? l.charAt(0).toUpperCase() + l.slice(1) : 'Default'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Custom instructions override</label>
                <Textarea
                  value={instructionsOverride}
                  onChange={(e) => setInstructionsOverride(e.target.value)}
                  rows={2}
                  placeholder="e.g. Make it extra special — she's turning 30!"
                  className="resize-y"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="occasion-form" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
