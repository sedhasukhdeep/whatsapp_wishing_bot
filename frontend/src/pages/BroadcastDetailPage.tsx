import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addBroadcastRecipients,
  generateBroadcastMessage,
  getBroadcast,
  listContacts,
  removeBroadcastRecipient,
  sendBroadcast,
} from '../api/client';
import type { BroadcastWithRecipients, Contact } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, Loader2, Send, Sparkles, UserPlus, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [broadcast, setBroadcast] = useState<BroadcastWithRecipients | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [addingRecipients, setAddingRecipients] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const b = await getBroadcast(Number(id));
    setBroadcast(b);
    setMessageText(b.message_text ?? '');
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Poll for progress when sending
  useEffect(() => {
    if (!broadcast || broadcast.status !== 'sent') return;
    const pending = broadcast.recipients.some((r) => !r.sent_at && !r.error);
    if (!pending) return;
    const interval = setInterval(() => load(), 2000);
    return () => clearInterval(interval);
  }, [broadcast, load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const updated = await generateBroadcastMessage(Number(id));
      setMessageText(updated.message_text ?? '');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError('');
    try {
      await sendBroadcast(Number(id));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function openRecipientPicker() {
    const c = await listContacts();
    setContacts(c);
    setSelectedContactIds(new Set());
    setShowRecipientPicker(true);
  }

  async function handleAddRecipients() {
    setAddingRecipients(true);
    try {
      await addBroadcastRecipients(Number(id), {
        contact_ids: Array.from(selectedContactIds),
        target_ids: [],
      });
      await load();
      setShowRecipientPicker(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  }

  async function handleRemoveRecipient(recipientId: number) {
    await removeBroadcastRecipient(Number(id), recipientId);
    await load();
  }

  if (loading || !broadcast) return <div className="p-8 text-muted-foreground">Loading...</div>;

  const isSent = broadcast.status === 'sent';
  const sentCount = broadcast.recipients.filter((r) => r.sent_at).length;
  const totalCount = broadcast.recipients.length;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => nav('/broadcasts')} className="gap-1">
          <ArrowLeft size={16} />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">{broadcast.name}</h1>
          <p className="text-sm text-muted-foreground">Occasion: {broadcast.occasion_name}</p>
        </div>
        <Badge className="ml-auto" variant={isSent ? 'secondary' : 'outline'}>
          {broadcast.status}
        </Badge>
      </div>

      {/* Message */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={5}
            disabled={isSent}
            className="resize-y text-sm"
            placeholder="Write your message or use AI to generate one. Use {name} to personalise per recipient."
          />
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">{'{name}'}</code> to insert each recipient's first name.
            {messageText.includes('{name}') && broadcast.recipients.length > 0 && (() => {
              const firstName = (broadcast.recipients[0].contact_name ?? '').split(' ')[0] || 'Friend';
              return <span className="ml-1 text-emerald-600 dark:text-emerald-400">Preview: "{messageText.replace(/\{name\}/g, firstName)}"</span>;
            })()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || isSent}
              className="gap-1"
            >
              <Sparkles size={14} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating...' : 'AI Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Recipients {totalCount > 0 && <span className="text-muted-foreground font-normal">({sentCount}/{totalCount} sent)</span>}
            </CardTitle>
            {!isSent && (
              <Button variant="outline" size="sm" onClick={openRecipientPicker} className="gap-1">
                <UserPlus size={14} />
                Add Recipients
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {broadcast.recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipients yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    {!isSent && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcast.recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.contact_name || r.target_name || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{r.recipient_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.error ? (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <XCircle size={12} /> {r.error}
                          </span>
                        ) : r.sent_at ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> Sent
                          </span>
                        ) : isSent ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 size={12} className="animate-spin" /> Pending
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Queued</span>
                        )}
                      </TableCell>
                      {!isSent && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive"
                            onClick={() => handleRemoveRecipient(r.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Send button */}
      {!isSent && (
        <Button
          size="lg"
          className="gap-2"
          disabled={sending || !messageText.trim() || broadcast.recipients.length === 0}
          onClick={handleSend}
        >
          <Send size={16} />
          {sending ? 'Sending...' : `Send to All (${totalCount})`}
        </Button>
      )}

      {/* Recipient picker dialog */}
      <Dialog open={showRecipientPicker} onOpenChange={setShowRecipientPicker}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Recipients</DialogTitle>
          </DialogHeader>

          {contacts.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Contacts</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {contacts.map((c) => (
                  <label key={c.id} className={cn('flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent text-sm')}>
                    <input
                      type="checkbox"
                      checked={selectedContactIds.has(c.id)}
                      onChange={(e) => {
                        const s = new Set(selectedContactIds);
                        if (e.target.checked) s.add(c.id); else s.delete(c.id);
                        setSelectedContactIds(s);
                      }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.relationship_label || c.relationship}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecipientPicker(false)}>Cancel</Button>
            <Button
              onClick={handleAddRecipients}
              disabled={addingRecipients || selectedContactIds.size === 0}
            >
              {addingRecipients ? 'Adding...' : `Add ${selectedContactIds.size} Recipients`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
