import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getDashboardToday, getDashboardUpcoming, listContacts, listTargets, triggerGenerate } from '../api/client';
import TodayCard from '../components/dashboard/TodayCard';
import UpcomingList from '../components/dashboard/UpcomingList';
import type { DashboardOccasionItem, DashboardUpcomingItem, MessageDraft, WhatsAppTarget } from '../types';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function DashboardPage() {
  const { openTour } = useOutletContext<{ openTour: () => void }>();
  const [today, setToday] = useState<DashboardOccasionItem[]>([]);
  const [upcoming, setUpcoming] = useState<DashboardUpcomingItem[]>([]);
  const [targets, setTargets] = useState<WhatsAppTarget[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generateMsg, setGenerateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [t, u, tgts, contacts] = await Promise.all([
      getDashboardToday(),
      getDashboardUpcoming(),
      listTargets(),
      listContacts(),
    ]);
    setToday(t);
    setUpcoming(u);
    setTargets(tgts);
    if (contacts.length === 0 && !localStorage.getItem('wishing_bot_tour_seen')) {
      openTour();
    }
    setLoading(false);
  }, [openTour]);

  useEffect(() => { load(); }, [load]);

  function handleDraftUpdate(updated: MessageDraft) {
    setToday((prev) =>
      prev.map((item) =>
        item.draft?.id === updated.id ? { ...item, draft: updated } : item
      )
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const result = await triggerGenerate();
      await load();
      setGenerateMsg({
        text: result.drafts_created > 0
          ? `${result.drafts_created} draft${result.drafts_created > 1 ? 's' : ''} generated.`
          : 'No occasions today — nothing to generate.',
        ok: true,
      });
    } catch (e: unknown) {
      setGenerateMsg({ text: e instanceof Error ? e.message : 'Failed to generate messages.', ok: false });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {generateMsg && (
            <span className={`text-sm ${generateMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {generateMsg.text}
            </span>
          )}
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            <Sparkles size={16} />
            {generating ? 'Generating...' : "Generate Today's Messages"}
          </Button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          Today's Occasions {today.length > 0 && <span className="text-muted-foreground font-normal text-base">({today.length})</span>}
        </h2>
        {today.length === 0
          ? <p className="text-muted-foreground text-sm">No occasions today.</p>
          : today.map((item) => (
              <TodayCard key={item.occasion.id} item={item} targets={targets} onUpdate={handleDraftUpdate} />
            ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Upcoming (next 7 days)</h2>
        <UpcomingList items={upcoming} />
      </section>
    </div>
  );
}
