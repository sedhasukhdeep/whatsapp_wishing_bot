import { useEffect, useRef, useState } from 'react';
import { confirmDetection, dismissDetection, getDetectionKeywords, getScanStatus, listContacts, listDetections, startScanHistory, updateDetectionKeywords } from '../api/client';
import type { Contact, DetectedOccasion, DetectionConfirmRequest, DetectionKeywords, OccasionKeyword, OccasionType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, History, Loader2, Plus, Radar, Settings, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatChatId(name: string | null, chatId: string): string {
  if (name) return name;
  if (chatId.endsWith('@g.us')) return 'Group chat';
  return `+${chatId.replace('@c.us', '')}`;
}

const CONFIDENCE_RANK: Record<string, number> = { high: 2, medium: 1, low: 0 };
const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-red-500 text-white',
};
const OCCASION_LABELS: Record<string, string> = {
  birthday: '🎂 Birthday',
  anniversary: '❤️ Anniversary',
  custom: '⭐ Custom',
};

// ── Grouping ────────────────────────────────────────────────────────────────

interface DetectionGroup {
  key: string;
  primary: DetectedOccasion;  // highest-confidence item; used to pre-fill confirm dialog
  members: DetectedOccasion[];
}

/**
 * Group detections that appear to be about the same occasion:
 * same source chat + occasion type + person (by contact id if matched, else normalised name).
 * Within a group the highest-confidence detection becomes the primary.
 */
function groupDetections(detections: DetectedOccasion[]): DetectionGroup[] {
  const map = new Map<string, DetectedOccasion[]>();

  for (const d of detections) {
    const personKey = d.matched_contact?.id != null
      ? `cid:${d.matched_contact.id}`
      : `name:${d.detected_name.toLowerCase().trim()}`;
    const key = `${d.source_chat_id}::${d.occasion_type}::${personKey}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }

  return Array.from(map.entries()).map(([key, members]) => {
    const sorted = [...members].sort(
      (a, b) => (CONFIDENCE_RANK[b.confidence] ?? 0) - (CONFIDENCE_RANK[a.confidence] ?? 0)
    );
    return { key, primary: sorted[0], members };
  });
}

// ── Confirm state ────────────────────────────────────────────────────────────

interface ConfirmState {
  group: DetectionGroup;
  contactId: string;
  occasionType: OccasionType;
  month: string;
  day: string;
  year: string;
  label: string;
  saving: boolean;
  error: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DetectionsPage() {
  const [detections, setDetections] = useState<DetectedOccasion[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [dismissingGroup, setDismissingGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [scanStatus, setScanStatus] = useState<{
    running: boolean; scanned: number; detected: number; total: number; error: string | null;
  } | null>(null);
  const [scanError, setScanError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [keywords, setKeywords] = useState<DetectionKeywords>({ ignore_keywords: [], occasion_keywords: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [keywordsSaving, setKeywordsSaving] = useState(false);
  const [newIgnoreKw, setNewIgnoreKw] = useState('');
  const [newOccKw, setNewOccKw] = useState('');
  const [newOccType, setNewOccType] = useState<OccasionType>('birthday');
  const [newOccLabel, setNewOccLabel] = useState('');

  useEffect(() => {
    Promise.all([listDetections(), listContacts(), getScanStatus(), getDetectionKeywords()]).then(([d, c, s, kw]) => {
      setDetections(d);
      setContacts(c);
      setScanStatus(s);
      setKeywords(kw);
      if (s.running) startPolling();
      setLoading(false);
    });
    return () => stopPolling();
  }, []);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const s = await getScanStatus();
      setScanStatus(s);
      if (!s.running) {
        stopPolling();
        listDetections().then(setDetections);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function handleScanHistory() {
    setScanError('');
    try {
      await startScanHistory();
      const s = await getScanStatus();
      setScanStatus(s);
      startPolling();
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Failed to start scan');
    }
  }

  function toggleExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function openConfirm(group: DetectionGroup) {
    const d = group.primary;
    setConfirmState({
      group,
      contactId: d.matched_contact?.id?.toString() ?? '',
      occasionType: d.occasion_type as OccasionType,
      month: d.detected_month?.toString() ?? '',
      day: d.detected_day?.toString() ?? '',
      year: d.detected_year?.toString() ?? '',
      label: d.occasion_label ?? '',
      saving: false,
      error: '',
    });
  }

  async function handleConfirm() {
    if (!confirmState) return;
    const { group, contactId, occasionType, month, day, year, label } = confirmState;

    if (!contactId) {
      setConfirmState((s) => s && { ...s, error: 'Please select a contact.' });
      return;
    }
    if (!month || !day) {
      setConfirmState((s) => s && { ...s, error: 'Month and day are required.' });
      return;
    }
    if (occasionType === 'custom' && !label.trim()) {
      setConfirmState((s) => s && { ...s, error: 'Label is required for custom occasions.' });
      return;
    }

    setConfirmState((s) => s && { ...s, saving: true, error: '' });
    try {
      const payload: DetectionConfirmRequest = {
        contact_id: parseInt(contactId),
        occasion_type: occasionType,
        month: parseInt(month),
        day: parseInt(day),
        year: year ? parseInt(year) : null,
        label: occasionType === 'custom' ? label.trim() : null,
      };
      // Confirm primary, then dismiss siblings
      await confirmDetection(group.primary.id, payload);
      const siblingIds = group.members.filter((m) => m.id !== group.primary.id).map((m) => m.id);
      await Promise.all(siblingIds.map((id) => dismissDetection(id)));

      const allIds = new Set(group.members.map((m) => m.id));
      setDetections((prev) => prev.filter((d) => !allIds.has(d.id)));
      setConfirmState(null);
    } catch (err: unknown) {
      setConfirmState((s) => s && {
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to confirm',
      });
    }
  }

  async function handleDismissGroup(group: DetectionGroup) {
    setDismissingGroup(group.key);
    try {
      await Promise.all(group.members.map((m) => dismissDetection(m.id)));
      const allIds = new Set(group.members.map((m) => m.id));
      setDetections((prev) => prev.filter((d) => !allIds.has(d.id)));
    } finally {
      setDismissingGroup(null);
    }
  }

  async function saveKeywords(updated: DetectionKeywords) {
    setKeywordsSaving(true);
    try {
      const saved = await updateDetectionKeywords(updated);
      setKeywords(saved);
    } finally {
      setKeywordsSaving(false);
    }
  }

  function addIgnoreKeyword() {
    const kw = newIgnoreKw.trim();
    if (!kw || keywords.ignore_keywords.includes(kw)) return;
    const updated = { ...keywords, ignore_keywords: [...keywords.ignore_keywords, kw] };
    setNewIgnoreKw('');
    saveKeywords(updated);
  }

  function removeIgnoreKeyword(kw: string) {
    saveKeywords({ ...keywords, ignore_keywords: keywords.ignore_keywords.filter((k) => k !== kw) });
  }

  function addOccasionKeyword() {
    const kw = newOccKw.trim();
    if (!kw) return;
    const entry: OccasionKeyword = {
      keyword: kw,
      occasion_type: newOccType,
      label: newOccType === 'custom' ? newOccLabel.trim() || null : null,
    };
    const updated = { ...keywords, occasion_keywords: [...keywords.occasion_keywords, entry] };
    setNewOccKw('');
    setNewOccLabel('');
    saveKeywords(updated);
  }

  function removeOccasionKeyword(idx: number) {
    saveKeywords({ ...keywords, occasion_keywords: keywords.occasion_keywords.filter((_, i) => i !== idx) });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 size={20} className="animate-spin" />
        Loading…
      </div>
    );
  }

  // Filter out detections whose raw_message contains any ignore keyword
  const ignoredKws = keywords.ignore_keywords.map((k) => k.toLowerCase());
  const visibleDetections = ignoredKws.length === 0
    ? detections
    : detections.filter((d) => !ignoredKws.some((kw) => d.raw_message.toLowerCase().includes(kw)));
  const hiddenByFilter = detections.length - visibleDetections.length;

  const groups = groupDetections(visibleDetections);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radar size={24} />
            Detected Occasions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Occasions detected from incoming WhatsApp messages. Review and confirm to add them to contacts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {groups.length > 0 && (
            <Badge className="text-sm px-3 py-1 bg-primary text-primary-foreground">
              {groups.length} pending
            </Badge>
          )}
          <Button
            variant="outline"
            className={cn("gap-2", showSettings && "bg-accent")}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings size={16} />
            Settings
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleScanHistory}
            disabled={scanStatus?.running}
          >
            {scanStatus?.running
              ? <Loader2 size={16} className="animate-spin" />
              : <History size={16} />}
            {scanStatus?.running ? 'Scanning…' : 'Scan History'}
          </Button>
        </div>
      </div>

      {/* Detection settings panel */}
      {showSettings && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4 space-y-5">
            {/* Ignore keywords */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">Ignore keywords</h3>
                <span className="text-xs text-muted-foreground">Messages containing these are silently skipped</span>
                {keywordsSaving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.ignore_keywords.map((kw) => (
                  <Badge key={kw} className="gap-1 bg-slate-500 text-white pr-1">
                    {kw}
                    <button onClick={() => removeIgnoreKeyword(kw)} className="hover:opacity-70">
                      <X size={11} />
                    </button>
                  </Badge>
                ))}
                {keywords.ignore_keywords.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">None — default filters apply</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm max-w-xs"
                  placeholder="e.g. happy new year"
                  value={newIgnoreKw}
                  onChange={(e) => setNewIgnoreKw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addIgnoreKeyword()}
                />
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={addIgnoreKeyword}>
                  <Plus size={13} /> Add
                </Button>
              </div>
            </div>

            {/* Occasion triggers */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">Occasion triggers</h3>
                <span className="text-xs text-muted-foreground">Custom keywords mapped to an occasion type</span>
              </div>
              {keywords.occasion_keywords.length > 0 && (
                <div className="flex flex-col gap-1 mb-3">
                  {keywords.occasion_keywords.map((ok, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Badge className="bg-blue-500 text-white font-mono">{ok.keyword}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge className="bg-blue-500 text-white">{OCCASION_LABELS[ok.occasion_type] ?? ok.occasion_type}{ok.label ? `: "${ok.label}"` : ''}</Badge>
                      <button onClick={() => removeOccasionKeyword(idx)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {keywords.occasion_keywords.length === 0 && (
                <p className="text-xs text-muted-foreground italic mb-3">None added yet</p>
              )}
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  className="h-8 text-sm w-36"
                  placeholder="keyword"
                  value={newOccKw}
                  onChange={(e) => setNewOccKw(e.target.value)}
                />
                <Select value={newOccType} onValueChange={(v) => setNewOccType(v as OccasionType)}>
                  <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="anniversary">Anniversary</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {newOccType === 'custom' && (
                  <Input
                    className="h-8 text-sm w-32"
                    placeholder="label"
                    value={newOccLabel}
                    onChange={(e) => setNewOccLabel(e.target.value)}
                  />
                )}
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={addOccasionKeyword}>
                  <Plus size={13} /> Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan progress */}
      {scanStatus?.running && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">Scanning chat history…</span>
              <span className="text-muted-foreground">
                {scanStatus.scanned} / {scanStatus.total} chats · {scanStatus.detected} new
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${scanStatus.total > 0 ? (scanStatus.scanned / scanStatus.total) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan complete summary */}
      {scanStatus && !scanStatus.running && scanStatus.total > 0 && (
        <Card className="mb-4 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10">
          <CardContent className="py-3 px-4 text-sm text-emerald-700 dark:text-emerald-400">
            Scan complete — {scanStatus.total} chat{scanStatus.total !== 1 ? 's' : ''} scanned,{' '}
            {scanStatus.detected} new detection{scanStatus.detected !== 1 ? 's' : ''} found.
          </CardContent>
        </Card>
      )}

      {scanError && (
        <div className="mb-4 rounded-md bg-destructive/10 text-destructive text-sm p-3">{scanError}</div>
      )}

      {hiddenByFilter > 0 && (
        <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm px-3 py-2">
          {hiddenByFilter} detection{hiddenByFilter !== 1 ? 's' : ''} hidden by ignore keywords.
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Radar size={48} className="text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No pending detections</h3>
            <p className="text-muted-foreground text-sm">
              Occasion detection runs automatically when messages arrive via WhatsApp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const d = group.primary;
            const isMulti = group.members.length > 1;
            const isExpanded = expandedGroups.has(group.key);
            const isDismissing = dismissingGroup === group.key;

            return (
              <Card key={group.key} className={cn(isMulti && 'border-primary/40')}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header: name + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold text-base">{d.detected_name || '(unnamed)'}</span>
                        <Badge className="border-0 bg-blue-500 text-white text-xs">
                          {OCCASION_LABELS[d.occasion_type] ?? d.occasion_type}
                        </Badge>
                        <Badge className={cn('border-0 text-xs', CONFIDENCE_STYLES[d.confidence] ?? CONFIDENCE_STYLES.medium)}>
                          {d.confidence} confidence
                        </Badge>
                        {isMulti && (
                          <Badge className="border-0 bg-violet-500 text-white text-xs">
                            {group.members.length} messages
                          </Badge>
                        )}
                      </div>

                      {/* Primary message preview */}
                      <p className="text-sm text-muted-foreground italic mb-2 line-clamp-2">
                        "{d.raw_message.slice(0, 140)}{d.raw_message.length > 140 ? '…' : ''}"
                      </p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          Group: <Badge className="border-0 bg-blue-500 text-white text-xs px-2 py-0.5">{formatChatId(d.source_chat_name, d.source_chat_id)}</Badge>
                        </span>
                        {d.sender_name && (
                          <span className="flex items-center gap-1.5">
                            Sender: <span className="font-medium text-foreground">{d.sender_name}</span>
                          </span>
                        )}
                        {d.detected_month != null && d.detected_day != null && (
                          <span>
                            Date: <span className="font-medium text-foreground">
                              {MONTHS[d.detected_month]} {d.detected_day}{d.detected_year != null ? `, ${d.detected_year}` : ''}
                            </span>
                          </span>
                        )}
                        {d.matched_contact != null && (
                          <span>
                            Match: <span className="font-medium text-foreground">
                              {d.matched_contact.name}
                              {d.match_score != null ? ` (${d.match_score}%)` : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Expand/collapse sibling messages */}
                      {isMulti && (
                        <button
                          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => toggleExpand(group.key)}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {isExpanded ? 'Hide' : 'Show'} {group.members.length - 1} similar message{group.members.length - 1 !== 1 ? 's' : ''}
                        </button>
                      )}

                      {/* Sibling messages */}
                      {isMulti && isExpanded && (
                        <div className="mt-3 pl-3 border-l-2 border-border flex flex-col gap-2">
                          {group.members.filter((m) => m.id !== d.id).map((m) => (
                            <div key={m.id} className="text-xs text-muted-foreground">
                              <span className="italic">"{m.raw_message.slice(0, 120)}{m.raw_message.length > 120 ? '…' : ''}"</span>
                              {m.detected_month != null && m.detected_day != null && (
                                <span className="ml-2 text-foreground font-medium">
                                  {MONTHS[m.detected_month]} {m.detected_day}{m.detected_year != null ? `, ${m.detected_year}` : ''}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDismissGroup(group)}
                        disabled={isDismissing}
                        title={isMulti ? `Dismiss all ${group.members.length} messages` : 'Dismiss'}
                      >
                        {isDismissing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      </Button>
                      <Button size="sm" onClick={() => openConfirm(group)}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmState && (
        <Dialog open onOpenChange={(open) => { if (!open) setConfirmState(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Occasion</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Primary message context */}
              <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
                "{confirmState.group.primary.raw_message.slice(0, 120)}{confirmState.group.primary.raw_message.length > 120 ? '…' : ''}"
              </p>
              {confirmState.group.members.length > 1 && (
                <p className="text-xs text-violet-600 dark:text-violet-400">
                  {confirmState.group.members.length - 1} similar message{confirmState.group.members.length - 1 !== 1 ? 's' : ''} will be automatically dismissed.
                </p>
              )}

              {/* Contact selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact</label>
                <Select
                  value={confirmState.contactId}
                  onValueChange={(v) => setConfirmState((s) => s && { ...s, contactId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Occasion type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Occasion type</label>
                <Select
                  value={confirmState.occasionType}
                  onValueChange={(v) => setConfirmState((s) => s && { ...s, occasionType: v as OccasionType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="anniversary">Anniversary</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Label (custom only) */}
              {confirmState.occasionType === 'custom' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={confirmState.label}
                    onChange={(e) => setConfirmState((s) => s && { ...s, label: e.target.value })}
                    placeholder="e.g. Work anniversary"
                  />
                </div>
              )}

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <div className="flex gap-2">
                  <Select
                    value={confirmState.month}
                    onValueChange={(v) => setConfirmState((s) => s && { ...s, month: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.slice(1).map((m, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Day"
                    value={confirmState.day}
                    onChange={(e) => setConfirmState((s) => s && { ...s, day: e.target.value })}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    min={1900}
                    max={2100}
                    placeholder="Year"
                    value={confirmState.year}
                    onChange={(e) => setConfirmState((s) => s && { ...s, year: e.target.value })}
                  />
                </div>
              </div>

              {/* Source chat note */}
              {confirmState.group.primary.source_chat_id.endsWith('@g.us') && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Messages for this occasion will be sent to the group where it was detected
                  ({formatChatId(confirmState.group.primary.source_chat_name, confirmState.group.primary.source_chat_id)}).
                </p>
              )}

              {confirmState.error && (
                <p className="text-sm text-destructive">{confirmState.error}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmState(null)}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={confirmState.saving}>
                {confirmState.saving && <Loader2 size={14} className="animate-spin mr-1" />}
                Add Occasion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
