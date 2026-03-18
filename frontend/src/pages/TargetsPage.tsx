import { useEffect, useRef, useState } from 'react';
import { createTarget, deleteTarget, getBridgeStatus, getWaChats, listTargets, updateTarget, type WaChat } from '../api/client';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import type { BridgeStatus, TargetType, WhatsAppTarget } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, ChevronDown, Loader2, Plus, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TargetFormState {
  name: string;
  chat_id: string;
  target_type: TargetType;
  description: string;
}

const EMPTY_FORM: TargetFormState = { name: '', chat_id: '', target_type: 'individual', description: '' };

export default function TargetsPage() {
  const [targets, setTargets] = useState<WhatsAppTarget[]>([]);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [waChats, setWaChats] = useState<WaChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<WhatsAppTarget | null>(null);
  const [form, setForm] = useState<TargetFormState>(EMPTY_FORM);
  const [chatSearch, setChatSearch] = useState('');
  const [showChatPicker, setShowChatPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState(false);
  const pollErrorCount = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [t, s] = await Promise.all([listTargets(), getBridgeStatus()]);
    setTargets(t);
    setStatus(s);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (status?.ready) return;
    const id = setInterval(async () => {
      try {
        const s = await getBridgeStatus();
        setStatus(s);
        pollErrorCount.current = 0;
        setPollError(false);
      } catch {
        pollErrorCount.current += 1;
        if (pollErrorCount.current >= 5) setPollError(true);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [status?.ready]);

  async function loadChats() {
    setChatsLoading(true);
    setChatsError('');
    try {
      const chats = await getWaChats();
      setWaChats(chats);
    } catch {
      setChatsError('Could not load chats — make sure WhatsApp is connected.');
    } finally {
      setChatsLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setChatSearch('');
    setShowChatPicker(false);
    setShowForm(true);
    loadChats();
  }

  function openEdit(t: WhatsAppTarget) {
    setForm({ name: t.name, chat_id: t.chat_id, target_type: t.target_type, description: t.description ?? '' });
    setEditTarget(t);
    setChatSearch('');
    setShowChatPicker(false);
    setShowForm(true);
    loadChats();
  }

  function selectChat(chat: WaChat) {
    setForm((f) => ({ ...f, chat_id: chat.id, target_type: chat.type, name: f.name || chat.name }));
    setShowChatPicker(false);
    setChatSearch('');
  }

  const filteredChats = waChats.filter((c) =>
    c.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
    c.id.includes(chatSearch)
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = { ...form, description: form.description || null };
      if (editTarget) {
        const updated = await updateTarget(editTarget.id, data);
        setTargets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      } else {
        const created = await createTarget(data);
        setTargets((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch {
      setError('Error saving target');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: WhatsAppTarget) {
    await deleteTarget(t.id);
    setTargets((prev) => prev.filter((x) => x.id !== t.id));
    setConfirmDelete(null);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Targets</h1>

      {/* Bridge status */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          {pollError && (
            <div className="mb-3 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              Bridge is not responding. Try restarting the app.
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            {status?.ready
              ? <CheckCircle2 size={18} className="text-emerald-500" />
              : status?.state === 'starting'
                ? <Loader2 size={18} className="text-muted-foreground animate-spin" />
                : status?.state === 'disconnected'
                  ? <WifiOff size={18} className="text-amber-500" />
                  : <WifiOff size={18} className="text-amber-500" />}
            <span className="font-semibold">
              WhatsApp:{' '}
              {status?.ready
                ? 'Connected'
                : status?.state === 'starting'
                  ? 'Starting up...'
                  : status?.state === 'disconnected'
                    ? 'Disconnected — reconnecting...'
                    : status?.state === 'error' && !status?.qr_image
                      ? 'Bridge is not responding'
                      : 'Not connected — scan QR to link your phone'}
            </span>
            <Button variant="outline" size="sm" onClick={load} className="ml-auto gap-1">
              <RefreshCw size={12} />
              Refresh
            </Button>
          </div>
          {status?.qr_image && (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Open WhatsApp → Settings → Linked Devices → Link a Device → scan below
              </p>
              <img src={status.qr_image} alt="WhatsApp QR" className="w-44 h-44 rounded-lg border" />
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Refreshing...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Send Targets</h2>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} />
          Add Target
        </Button>
      </div>

      {targets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No targets yet. Add one to send messages.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Chat ID</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="font-medium">{t.name}</span>
                    {t.description && <span className="text-muted-foreground text-xs ml-2">{t.description}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      'border-0 text-xs',
                      t.target_type === 'group'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    )}>
                      {t.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.chat_id}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(t)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setConfirmDelete(t)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Target' : 'Add Target'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {status?.ready
              ? 'Select a chat from your WhatsApp to link it as a send target.'
              : 'Connect WhatsApp first to pick chats automatically.'}
          </p>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Chat *</label>
              <div className="relative">
                <div
                  onClick={() => { setShowChatPicker((v) => !v); setTimeout(() => searchRef.current?.focus(), 50); }}
                  className="flex items-center justify-between px-3 py-2 border border-input rounded-md cursor-pointer bg-background text-sm"
                >
                  <span className={form.chat_id ? 'text-foreground' : 'text-muted-foreground'}>
                    {form.chat_id
                      ? (waChats.find((c) => c.id === form.chat_id)?.name || form.chat_id)
                      : 'Select a chat...'}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </div>

                {showChatPicker && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-background border border-border rounded-md shadow-lg">
                    <div className="p-2">
                      <Input
                        ref={searchRef}
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Search by name..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {chatsLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading chats...</div>}
                    {chatsError && <div className="px-3 py-2 text-sm text-destructive">{chatsError}</div>}
                    {!chatsLoading && !chatsError && filteredChats.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No chats found</div>
                    )}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => selectChat(chat)}
                          className={cn(
                            'px-3 py-2 cursor-pointer hover:bg-accent border-b border-border last:border-0 text-sm',
                            form.chat_id === chat.id && 'bg-accent'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{chat.name}</span>
                            <Badge className={cn(
                              'border-0 text-xs',
                              chat.type === 'group'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            )}>
                              {chat.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">{chat.id}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Label *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. Family Group, Wifey"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. For birthday wishes only"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.chat_id}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete target "${confirmDelete.name}"?`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
