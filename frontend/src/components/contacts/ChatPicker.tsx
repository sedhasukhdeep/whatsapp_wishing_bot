import { useEffect, useRef, useState } from 'react';
import { getBridgeStatus, getWaChats, type WaChat } from '../../api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  chatId: string | null;
  chatName: string | null;
  onChange: (chatId: string | null, chatName: string | null) => void;
}

export default function ChatPicker({ chatId, chatName, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<WaChat[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    setError('');
    setChats([]);
    try {
      const status = await getBridgeStatus();
      if (!status.ready) {
        setError('WhatsApp is not connected. Go to WhatsApp Targets page to scan the QR code first.');
        setLoading(false);
        return;
      }
      const list = await getWaChats();
      setChats(list);
    } catch {
      setError('Could not load chats. Make sure the WhatsApp bridge is running.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = chats.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center justify-between border border-border rounded-md p-3 bg-muted/30 min-h-12">
        {chatId ? (
          <>
            <div>
              <div className="text-sm font-medium">{chatName || chatId}</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">{chatId}</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openPicker}>Change</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30"
                onClick={() => onChange(null, null)}
              >
                Unlink
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">No WhatsApp chat linked</span>
            <Button type="button" variant="outline" size="sm" onClick={openPicker}>Pick Chat</Button>
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-background border border-border rounded-lg shadow-xl max-h-80 overflow-auto">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search chats..."
            />
          </div>
          {loading && <div className="px-4 py-3 text-sm text-muted-foreground">Loading chats...</div>}
          {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No chats found.</div>
          )}
          {!loading && !error && filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                'flex items-center justify-between w-full px-4 py-2.5 text-left border-b border-border last:border-0',
                'hover:bg-accent transition-colors cursor-pointer'
              )}
              onClick={() => {
                onChange(c.id, c.name);
                setOpen(false);
                setFilter('');
              }}
            >
              <span className="font-medium text-sm">{c.name}</span>
              <Badge variant="outline" className={cn(
                'text-xs',
                c.type === 'group'
                  ? 'border-blue-300 text-blue-700 dark:text-blue-300'
                  : 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
              )}>
                {c.type}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
