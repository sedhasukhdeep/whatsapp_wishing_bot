import { useState } from 'react';
import { approveDraft, regenerateDraft, sendDraft, skipDraft } from '../../api/client';
import type { DashboardOccasionItem, MessageDraft, WhatsAppTarget } from '../../types';
import StatusBadge from '../shared/StatusBadge';
import MessageEditor from './MessageEditor';

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

const EMOJI: Record<string, string> = { birthday: '🎂', anniversary: '💍', custom: '🎉' };

export default function TodayCard({ item, targets, onUpdate }: Props) {
  const { contact, draft } = item;
  const initialText = draft?.edited_text ?? draft?.generated_text ?? '';
  const [text, setText] = useState(initialText);
  const [selectedTarget, setSelectedTarget] = useState<number | ''>('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  // If the contact has a linked WhatsApp chat, we can send directly without picking a target
  const linkedChat = contact.whatsapp_chat_id;
  const linkedChatName = contact.whatsapp_chat_name || contact.whatsapp_chat_id;
  const canSendDirectly = !!linkedChat;
  const canSendViaTarget = selectedTarget !== '';
  const canSend = canSendDirectly || canSendViaTarget;

  const currentDraft = draft;

  async function handle(action: () => Promise<MessageDraft>) {
    setError('');
    try {
      const updated = await action();
      onUpdate(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'An error occurred';
      setError(msg);
    } finally {
      setLoading(null);
    }
  }

  function handleSend() {
    setLoading('send');
    const targetId = canSendDirectly ? null : (selectedTarget as number);
    handle(() => sendDraft(currentDraft!.id, targetId));
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {EMOJI[item.occasion.type] || '🎉'} {contact.name}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {occasionLabel(item)} · {contact.relationship}
          </div>
        </div>
        {currentDraft && <StatusBadge status={currentDraft.status} />}
      </div>

      {currentDraft ? (
        <>
          <MessageEditor
            value={text}
            onChange={setText}
            onRegenerate={async () => {
              setLoading('regen');
              await handle(async () => {
                const d = await regenerateDraft(currentDraft.id);
                setText(d.generated_text);
                return d;
              });
            }}
            regenerating={loading === 'regen'}
          />

          {currentDraft.status !== 'sent' && currentDraft.status !== 'skipped' && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  style={btnPrimary}
                  disabled={!!loading}
                  onClick={() => {
                    setLoading('approve');
                    handle(() => approveDraft(currentDraft.id, text !== currentDraft.generated_text ? text : undefined));
                  }}
                >
                  {loading === 'approve' ? '...' : 'Approve'}
                </button>

                {/* Send section */}
                {canSendDirectly ? (
                  <button
                    style={{ ...btnGreen, opacity: currentDraft.status === 'approved' ? 1 : 0.5 }}
                    disabled={currentDraft.status !== 'approved' || !!loading}
                    onClick={handleSend}
                  >
                    {loading === 'send' ? '...' : `Send to ${linkedChatName}`}
                  </button>
                ) : (
                  <>
                    <select
                      value={selectedTarget}
                      onChange={(e) => setSelectedTarget(Number(e.target.value) || '')}
                      style={selectStyle}
                    >
                      <option value="">Select target...</option>
                      {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button
                      style={{ ...btnGreen, opacity: (currentDraft.status === 'approved' && canSendViaTarget) ? 1 : 0.5 }}
                      disabled={currentDraft.status !== 'approved' || !canSendViaTarget || !!loading}
                      onClick={handleSend}
                    >
                      {loading === 'send' ? '...' : 'Send'}
                    </button>
                  </>
                )}

                <button
                  style={btnGhost}
                  disabled={!!loading}
                  onClick={() => { setLoading('skip'); handle(() => skipDraft(currentDraft.id)); }}
                >
                  Skip
                </button>
              </div>

              {!canSendDirectly && targets.length === 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Tip: Link a WhatsApp chat to this contact's profile to send with one click.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
          No draft yet — click "Generate Today's Messages" above.
        </div>
      )}

      {error && <div style={{ marginTop: 8, fontSize: 13, color: '#ef4444' }}>{error}</div>}
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
  padding: 16, marginBottom: 16,
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13,
};
const btnGreen: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 13,
};
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280',
};
const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff',
};
