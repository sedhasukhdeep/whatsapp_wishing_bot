import { useEffect, useRef, useState } from 'react';
import { getBridgeStatus } from '../api/client';
import type { BridgeStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react';

export default function TargetsPage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [pollError, setPollError] = useState(false);
  const pollErrorCount = useRef(0);

  async function load() {
    const s = await getBridgeStatus();
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">WhatsApp</h1>

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
    </div>
  );
}
