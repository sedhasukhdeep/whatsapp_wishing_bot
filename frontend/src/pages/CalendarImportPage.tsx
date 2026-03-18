import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmCalendarImport, previewCalendarImport } from '../api/client';
import type { CalendarImportConfirmItem, CalendarImportPreviewItem, RelationshipType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const OCCASION_COLORS: Record<string, string> = {
  birthday: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  anniversary: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  custom: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

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
    const items = preview.filter((_, i) => selected.has(i));
    const missing = items.filter((item) => {
      const idx = preview.indexOf(item);
      return !item.existing_contact_id && !phones[idx]?.trim();
    });
    if (missing.length > 0) {
      setError(`Please enter phone numbers for: ${missing.map((m) => m.name).join(', ')}`);
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
          phone: phones[idx]?.trim() || '',
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => nav('/contacts')} className="gap-1">
          <ArrowLeft size={16} />
          Back
        </Button>
        <h1 className="text-xl font-bold">Import from Calendar</h1>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Calendar File</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Export your contacts' birthdays and anniversaries from Google Calendar or Apple Calendar as an .ics file.
            </p>
            <ul className="text-sm text-muted-foreground mb-6 space-y-1 list-disc pl-5">
              <li><strong>Google Calendar:</strong> Settings → [Calendar] → Export calendar</li>
              <li><strong>Apple Calendar:</strong> File → Export → Export…</li>
            </ul>

            <input
              ref={fileRef}
              type="file"
              accept=".ics"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2">
              <Upload size={16} />
              {loading ? 'Parsing...' : 'Choose .ics File'}
            </Button>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Found {preview.length} event{preview.length !== 1 ? 's' : ''}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set(preview.map((_, i) => i)))}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Review and select which events to import. For new contacts, enter their phone number.
              </p>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Occasion</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Phone *</TableHead>
                      <TableHead>Relationship</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((item, idx) => (
                      <TableRow key={idx} className={cn(!selected.has(idx) && 'opacity-40')}>
                        <TableCell>
                          <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge className={cn('border-0 text-xs', OCCASION_COLORS[item.occasion_type] ?? OCCASION_COLORS.custom)}>
                            {item.occasion_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {MONTHS[item.month]} {item.day}{item.year ? `, ${item.year}` : ''}
                        </TableCell>
                        <TableCell>
                          {item.existing_contact_id ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              Existing: {item.existing_contact_name}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 dark:text-amber-400">New contact</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.existing_contact_id ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Input
                              value={phones[idx] ?? ''}
                              onChange={(e) => setPhones((p) => ({ ...p, [idx]: e.target.value }))}
                              placeholder="+919876543210"
                              className={cn('h-7 text-xs w-36', selected.has(idx) && !phones[idx]?.trim() && 'border-destructive')}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {item.existing_contact_id ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Select
                              value={relationships[idx] ?? 'friend'}
                              onValueChange={(v) => setRelationships((r) => ({ ...r, [idx]: v as RelationshipType }))}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="family">Family</SelectItem>
                                <SelectItem value="friend">Friend</SelectItem>
                                <SelectItem value="colleague">Colleague</SelectItem>
                                <SelectItem value="acquaintance">Acquaintance</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('upload'); setPreview([]); }}>Back</Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || selected.size === 0}
            >
              {loading ? 'Importing...' : `Import ${selected.size} event${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Import Complete</h2>
            <p className="text-muted-foreground mb-6">
              Created {result.contacts_created} new contact{result.contacts_created !== 1 ? 's' : ''} and{' '}
              {result.occasions_created} occasion{result.occasions_created !== 1 ? 's' : ''}.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => nav('/contacts')}>View Contacts</Button>
              <Button variant="outline" onClick={() => { setStep('upload'); setPreview([]); setResult(null); }}>
                Import More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
