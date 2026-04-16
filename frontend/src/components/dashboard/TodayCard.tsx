import { useEffect, useState } from 'react';
import { approveDraft, regenerateDraft, scheduleDraft, sendDraft, skipDraft, updateDraftGif } from '../../api/client';
import type { DashboardOccasionItem, MessageDraft, WhatsAppTarget } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';
import StatusBadge from '../shared/StatusBadge';
import MessageEditor from './MessageEditor';
import GifPicker from './GifPicker';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, Cake, Heart, ImagePlus, Star, X } from 'lucide-react';

interface Props {
  item: DashboardOccasionItem;
  targets: WhatsAppTarget[];
  onUpdate: (draft: MessageDraft) => void;
}

function occasionLabel(item: DashboardOccasionItem) {
  const { occasion, turning_age, years_together } = item;
  if (occasion.type === 'birthday') return turning_age ? `Birthday (turning ${turning_age})` : 'Birthday';
  if (occasion.type === 'anniversary') return years_together ? `Anniversary (${years_together} years)` : 'Anniversary';
  return occasion.label || 'Special Occasion';
}

const ICON_MAP: Record<string, React.ReactNode> = {
  birthday: <Cake size={16} />,
  anniversary: <Heart size={16} />,
  custom: <Star size={16} />,
};

export default function TodayCard({ item, targets, onUpdate }: Props) {
  const { contact, draft } = item;
  const initialText = draft?.edited_text ?? draft?.generated_text ?? '';
  const [text, setText] = useState(initialText);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Feedback for regeneration
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  // Schedule picker
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleFor, setScheduleFor] = useState('');

  useEffect(() => {
    setText(draft?.edited_text ?? draft?.generated_text ?? '');
    setGifUrl(draft?.gif_url ?? null);
  }, [draft?.id]);

  const linkedChat = contact.whatsapp_chat_id;
  const linkedChatName = contact.whatsapp_chat_name || contact.whatsapp_chat_id;
  const canSendDirectly = !!linkedChat;
  const canSendViaTarget = selectedTarget !== '';
  const hasEdits = text !== (draft?.generated_text ?? '');
  const currentDraft = draft;

  async function handle(action: () => Promise<MessageDraft>, successMsg?: string) {
    setError('');
    setSuccess('');
    try {
      const updated = await action();
      onUpdate(updated);
      if (successMsg) {
        setSuccess(successMsg);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  }

  function doRegen() {
    setLoading('regen');
    const feedback = feedbackText.trim() || undefined;
    handle(async () => {
      const d = await regenerateDraft(currentDraft!.id, feedback);
      setText(d.generated_text);
      setFeedbackText('');
      setShowFeedback(false);
      return d;
    });
  }

  function handleSend() {
    setLoading('send');
    const targetId = canSendDirectly ? null : parseInt(selectedTarget, 10);
    handle(() => sendDraft(currentDraft!.id, targetId, gifUrl), 'Message sent!');
  }

  function handleApprove() {
    setLoading('approve');
    setError('');
    setSuccess('');
    const editedText = text !== currentDraft!.generated_text ? text : undefined;
    approveDraft(currentDraft!.id, editedText)
      .then((updated) => {
        onUpdate(updated);
        setSuccess(updated.status === 'sent' ? 'Approved & sent!' : 'Approved!');
        setTimeout(() => setSuccess(''), 3000);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'An error occurred');
      })
      .finally(() => setLoading(null));
  }

  function handleSchedule() {
    if (!scheduleFor) return;
    setLoading('schedule');
    handle(async () => {
      const d = await scheduleDraft(currentDraft!.id, new Date(scheduleFor).toISOString());
      setShowSchedule(false);
      return d;
    }, 'Scheduled!');
  }

  const approveLabel = contact.auto_send
    ? (loading === 'approve' ? '...' : 'Approve & Send')
    : (loading === 'approve' ? '...' : 'Approve');

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-base">
              {ICON_MAP[item.occasion.type] ?? <Star size={16} />}
              {contact.name}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {occasionLabel(item)} · {contact.relationship}
              {contact.relationship_label && ` (${contact.relationship_label})`}
            </div>
          </div>
          {currentDraft && <StatusBadge status={currentDraft.status} />}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {currentDraft ? (
          <>
            <MessageEditor
              value={text}
              onChange={setText}
              onRegenerate={() => {
                if (hasEdits) setConfirmRegen(true);
                else doRegen();
              }}
              regenerating={loading === 'regen'}
            />

            {/* Feedback for regeneration */}
            <div className="mb-3">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => setShowFeedback((v) => !v)}
              >
                {showFeedback ? 'Hide feedback' : 'Add feedback for regeneration'}
              </button>
              {showFeedback && (
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What to change? e.g. Make it funnier, keep it shorter, add a quote..."
                  rows={2}
                  className="mt-1.5 text-sm resize-none"
                />
              )}
            </div>

            {/* Scheduled time indicator */}
            {currentDraft.status === 'scheduled' && currentDraft.scheduled_for && (
              <p className="mb-3 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <CalendarClock size={12} />
                Scheduled for {new Date(currentDraft.scheduled_for).toLocaleString()}
              </p>
            )}

            {/* GIF preview */}
            {gifUrl && (
              <div className="relative inline-block mb-3">
                <video
                  src={gifUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-24 rounded border"
                />
                <button
                  onClick={() => {
                    setGifUrl(null);
                    if (currentDraft) updateDraftGif(currentDraft.id, null).catch(() => {});
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {currentDraft.status !== 'sent' && currentDraft.status !== 'skipped' && (
              <>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    size="sm"
                    disabled={!!loading}
                    onClick={handleApprove}
                  >
                    {approveLabel}
                  </Button>

                  {canSendDirectly ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={currentDraft.status !== 'approved' || !!loading}
                      onClick={handleSend}
                    >
                      {loading === 'send' ? 'Sending...' : `Send to ${linkedChatName}`}
                    </Button>
                  ) : (
                    <>
                      <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue placeholder="Select target..." />
                        </SelectTrigger>
                        <SelectContent>
                          {targets.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={currentDraft.status !== 'approved' || !canSendViaTarget || !!loading}
                        onClick={handleSend}
                      >
                        {loading === 'send' ? 'Sending...' : 'Send'}
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loading}
                    onClick={() => { setLoading('skip'); handle(() => skipDraft(currentDraft.id)); }}
                  >
                    Skip
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground"
                    onClick={() => setShowGifPicker(true)}
                  >
                    <ImagePlus size={14} />
                    {gifUrl ? 'Change GIF' : 'Add GIF'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground"
                    onClick={() => setShowSchedule((v) => !v)}
                  >
                    <CalendarClock size={14} />
                    {currentDraft.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                  </Button>
                </div>

                {/* Inline schedule picker */}
                {showSchedule && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={scheduleFor}
                      onChange={(e) => setScheduleFor(e.target.value)}
                      className="text-sm border rounded px-2 py-1 bg-background text-foreground"
                    />
                    <Button
                      size="sm"
                      disabled={!scheduleFor || !!loading}
                      onClick={handleSchedule}
                    >
                      {loading === 'schedule' ? '...' : 'Confirm'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowSchedule(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No draft yet — click "Generate Today's Messages" above.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">{success}</p>}

        {confirmRegen && (
          <ConfirmDialog
            message="Your edits will be lost. Regenerate the message anyway?"
            onConfirm={() => { setConfirmRegen(false); doRegen(); }}
            onCancel={() => setConfirmRegen(false)}
          />
        )}

        {showGifPicker && (
          <GifPicker
            onSelect={(mp4, _preview) => {
              setGifUrl(mp4);
              setShowGifPicker(false);
              if (currentDraft) {
                updateDraftGif(currentDraft.id, mp4).catch(() => {});
              }
            }}
            onCancel={() => setShowGifPicker(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
