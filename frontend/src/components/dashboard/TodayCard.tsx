import { useEffect, useState } from 'react';
import { approveDraft, regenerateDraft, sendDraft, skipDraft } from '../../api/client';
import type { DashboardOccasionItem, MessageDraft, WhatsAppTarget } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';
import StatusBadge from '../shared/StatusBadge';
import MessageEditor from './MessageEditor';
import GifPicker from './GifPicker';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Cake, Heart, ImagePlus, Star, X } from 'lucide-react';

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
  const [gifPreview, setGifPreview] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  useEffect(() => {
    setText(draft?.edited_text ?? draft?.generated_text ?? '');
    setGifUrl(draft?.gif_url ?? null);
    setGifPreview(null);
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
    handle(async () => {
      const d = await regenerateDraft(currentDraft!.id);
      setText(d.generated_text);
      return d;
    });
  }

  function handleSend() {
    setLoading('send');
    const targetId = canSendDirectly ? null : parseInt(selectedTarget, 10);
    handle(() => sendDraft(currentDraft!.id, targetId, gifUrl), 'Message sent!');
  }

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

            {/* GIF preview */}
            {gifPreview && (
              <div className="relative inline-block mb-3">
                <img src={gifPreview} alt="Selected GIF" className="h-24 rounded border" />
                <button
                  onClick={() => { setGifUrl(null); setGifPreview(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {currentDraft.status !== 'sent' && currentDraft.status !== 'skipped' && (
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  size="sm"
                  disabled={!!loading}
                  onClick={() => {
                    setLoading('approve');
                    handle(
                      () => approveDraft(currentDraft.id, text !== currentDraft.generated_text ? text : undefined),
                      'Approved!'
                    );
                  }}
                >
                  {loading === 'approve' ? '...' : 'Approve'}
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
              </div>
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
            onSelect={(mp4, preview) => {
              setGifUrl(mp4);
              setGifPreview(preview);
              setShowGifPicker(false);
            }}
            onCancel={() => setShowGifPicker(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
