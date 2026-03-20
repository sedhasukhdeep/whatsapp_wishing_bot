import { useEffect, useState } from 'react';
import { confirmDetection, dismissDetection, listContacts, listDetections } from '../api/client';
import type { Contact, DetectedOccasion, DetectionConfirmRequest, OccasionType } from '../types';
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
import { Loader2, Radar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const OCCASION_LABELS: Record<string, string> = {
  birthday: '🎂 Birthday',
  anniversary: '❤️ Anniversary',
  custom: '⭐ Custom',
};

interface ConfirmState {
  detection: DetectedOccasion;
  contactId: string;
  occasionType: OccasionType;
  month: string;
  day: string;
  year: string;
  label: string;
  saving: boolean;
  error: string;
}

export default function DetectionsPage() {
  const [detections, setDetections] = useState<DetectedOccasion[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [dismissing, setDismissing] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([listDetections(), listContacts()]).then(([d, c]) => {
      setDetections(d);
      setContacts(c);
      setLoading(false);
    });
  }, []);

  function openConfirm(d: DetectedOccasion) {
    setConfirmState({
      detection: d,
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
    const { detection, contactId, occasionType, month, day, year, label } = confirmState;

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
      await confirmDetection(detection.id, payload);
      setDetections((prev) => prev.filter((d) => d.id !== detection.id));
      setConfirmState(null);
    } catch (err: unknown) {
      setConfirmState((s) => s && {
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to confirm',
      });
    }
  }

  async function handleDismiss(id: number) {
    setDismissing(id);
    try {
      await dismissDetection(id);
      setDetections((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDismissing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 size={20} className="animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radar size={24} />
            Detected Occasions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Occasions detected from incoming WhatsApp messages. Review and confirm to add them to contacts.
          </p>
        </div>
        {detections.length > 0 && (
          <Badge className="text-sm px-3 py-1 bg-primary text-primary-foreground">
            {detections.length} pending
          </Badge>
        )}
      </div>

      {detections.length === 0 ? (
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
          {detections.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header: name + badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-base">{d.detected_name || '(unnamed)'}</span>
                      <Badge className="border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                        {OCCASION_LABELS[d.occasion_type] ?? d.occasion_type}
                      </Badge>
                      <Badge className={cn('border-0 text-xs', CONFIDENCE_STYLES[d.confidence] ?? CONFIDENCE_STYLES.medium)}>
                        {d.confidence} confidence
                      </Badge>
                    </div>

                    {/* Raw message */}
                    <p className="text-sm text-muted-foreground italic mb-2 line-clamp-2">
                      "{d.raw_message.slice(0, 140)}{d.raw_message.length > 140 ? '…' : ''}"
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Source: <span className="font-medium text-foreground">{d.source_chat_name || d.source_chat_id}</span>
                      </span>
                      {d.detected_month && d.detected_day && (
                        <span>
                          Date: <span className="font-medium text-foreground">
                            {MONTHS[d.detected_month]} {d.detected_day}{d.detected_year ? `, ${d.detected_year}` : ''}
                          </span>
                        </span>
                      )}
                      {d.matched_contact && (
                        <span>
                          Match: <span className="font-medium text-foreground">
                            {d.matched_contact.name}
                            {d.match_score != null && ` (${d.match_score}%)`}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDismiss(d.id)}
                      disabled={dismissing === d.id}
                    >
                      {dismissing === d.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </Button>
                    <Button size="sm" onClick={() => openConfirm(d)}>
                      Confirm
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
              {/* Detected message context */}
              <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
                "{confirmState.detection.raw_message.slice(0, 120)}{confirmState.detection.raw_message.length > 120 ? '…' : ''}"
              </p>

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
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {m}
                        </SelectItem>
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
              {confirmState.detection.source_chat_id.endsWith('@g.us') && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Messages for this occasion will be sent to the group where it was detected
                  ({confirmState.detection.source_chat_name || confirmState.detection.source_chat_id}).
                </p>
              )}

              {confirmState.error && (
                <p className="text-sm text-destructive">{confirmState.error}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmState(null)}>
                Cancel
              </Button>
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
