import { useEffect, useRef, useState } from 'react';
import { getBridgeStatus, getWaChats, type WaChat } from '../../api/client';

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
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={linkedBox}>
        {chatId ? (
          <>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{chatName || chatId}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{chatId}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={openPicker} style={btnSmall}>Change</button>
              <button
                type="button"
                onClick={() => onChange(null, null)}
                style={{ ...btnSmall, color: '#dc2626', borderColor: '#fca5a5' }}
              >
                Unlink
              </button>
            </div>
          </>
        ) : (
          <>
            <span style={{ fontSize: 14, color: '#9ca3af' }}>No WhatsApp chat linked</span>
            <button type="button" onClick={openPicker} style={btnSmall}>Pick Chat</button>
          </>
        )}
      </div>

      {open && (
        <div style={dropdown}>
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search chats..."
            style={searchInput}
          />
          {loading && <div style={dropMsg}>Loading chats...</div>}
          {error && <div style={{ ...dropMsg, color: '#dc2626' }}>{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div style={dropMsg}>No chats found.</div>
          )}
          {!loading && !error && filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              style={chatRow}
              onClick={() => {
                onChange(c.id, c.name);
                setOpen(false);
                setFilter('');
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 6px', borderRadius: 10 }}>
                {c.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const linkedBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px',
  background: '#f9fafb', minHeight: 48,
};
const btnSmall: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 5, border: '1px solid #d1d5db',
  background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
};
const dropdown: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
  background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, maxHeight: 340, overflow: 'auto',
};
const searchInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 14px',
  border: 'none', borderBottom: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
};
const dropMsg: React.CSSProperties = { padding: '12px 14px', fontSize: 14, color: '#6b7280' };
const chatRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '10px 14px', border: 'none', background: 'transparent',
  cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f3f4f6',
};
