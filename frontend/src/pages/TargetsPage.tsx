import { useEffect, useRef, useState } from 'react';
import { getBridgeStatus, initBridgeSession, restartBridgeSession } from '../api/client';
import type { BridgeStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, Link, RefreshCw, WifiOff, RotateCcw } from 'lucide-react';

export default function TargetsPage() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [pollError, setPollError] = useState(false);
  const [initing, setIniting] = useState(false);
  const [startingElapsed, setStartingElapsed] = useState(0);
  const pollErrorCount = useRef(0);
  const startingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const s = await getBridgeStatus();
    setStatus(s);
  }

  async function handleConnect() {
    setIniting(true);
    setStartingElapsed(0);
    try {
      const s = isStartingStuck ? await restartBridgeSession() : await initBridgeSession();
      setStatus(s);
    } catch {
      // status poll will show the error state
    } finally {
      setIniting(false);
    }
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

  // Track time spent in 'starting' state so we can offer a retry if stuck
  useEffect(() => {
    if (status?.state === 'starting') {
      setStartingElapsed(0);
      startingTimerRef.current = setInterval(() => {
        setStartingElapsed((s) => s + 1);
      }, 1000);
    } else {
      setStartingElapsed(0);
      if (startingTimerRef.current) {
        clearInterval(startingTimerRef.current);
        startingTimerRef.current = null;
      }
    }
    return () => {
      if (startingTimerRef.current) {
        clearInterval(startingTimerRef.current);
        startingTimerRef.current = null;
      }
    };
  }, [status?.state]);

  const isStartingStuck = status?.state === 'starting' && startingElapsed >= 30;
  const canConnect = !status?.ready && status?.state !== 'starting';

  function statusText() {
    if (!status) return 'Checking status...';
    if (status.ready) return 'Connected';
    if (status.state === 'starting') {
      return isStartingStuck
        ? 'Still starting up — taking longer than expected'
        : 'Starting up...';
    }
    if (status.state === 'qr') return 'Scan QR code to link your phone';
    if (status.state === 'disconnected') return 'Disconnected — reconnecting...';
    if (status.state === 'error') return 'Bridge error — try restarting the app';
    return 'Not connected';
  }

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
              : status?.state === 'starting' && !isStartingStuck
                ? <Loader2 size={18} className="text-muted-foreground animate-spin" />
                : <WifiOff size={18} className="text-amber-500" />}
            <span className="font-semibold">
              WhatsApp: {statusText()}
            </span>
            <div className="ml-auto flex gap-2">
              {(canConnect || isStartingStuck) && !status?.qr_image && (
                <Button variant="default" size="sm" onClick={handleConnect} disabled={initing} className="gap-1">
                  {initing
                    ? <Loader2 size={12} className="animate-spin" />
                    : isStartingStuck
                      ? <RotateCcw size={12} />
                      : <Link size={12} />}
                  {isStartingStuck ? 'Retry' : 'Connect WhatsApp'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={load} className="gap-1">
                <RefreshCw size={12} />
                Refresh
              </Button>
            </div>
          </div>
          {status?.state === 'starting' && !isStartingStuck && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              Launching WhatsApp session — QR code will appear here shortly...
            </p>
          )}
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
          {status?.state === 'qr' && !status?.qr_image && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              Loading QR code...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
