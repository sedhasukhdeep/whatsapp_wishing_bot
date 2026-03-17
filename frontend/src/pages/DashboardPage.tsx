import { useCallback, useEffect, useState } from 'react';
import { getDashboardToday, getDashboardUpcoming, listContacts, listTargets, triggerGenerate } from '../api/client';
import TodayCard from '../components/dashboard/TodayCard';
import UpcomingList from '../components/dashboard/UpcomingList';
import OnboardingWizard from '../components/OnboardingWizard';
import type { DashboardOccasionItem, DashboardUpcomingItem, MessageDraft, WhatsAppTarget } from '../types';

export default function DashboardPage() {
  const [today, setToday] = useState<DashboardOccasionItem[]>([]);
  const [upcoming, setUpcoming] = useState<DashboardUpcomingItem[]>([]);
  const [targets, setTargets] = useState<WhatsAppTarget[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generateMsg, setGenerateMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
    if (contacts.length === 0) setShowOnboarding(true);
    setLoading(false);
  }, []);

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

  if (loading) return <div style={page}>Loading...</div>;

  return (
    <div style={page}>
      {showOnboarding && (
        <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={heading}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {generateMsg && (
            <span style={{ fontSize: 13, color: generateMsg.ok ? '#059669' : '#dc2626' }}>
              {generateMsg.text}
            </span>
          )}
          <button onClick={handleGenerate} disabled={generating} style={btnPrimary}>
            {generating ? 'Generating...' : "Generate Today's Messages"}
          </button>
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={subheading}>Today's Occasions {today.length > 0 && `(${today.length})`}</h2>
        {today.length === 0
          ? <p style={{ color: '#9ca3af', fontSize: 14 }}>No occasions today.</p>
          : today.map((item) => (
              <TodayCard key={item.occasion.id} item={item} targets={targets} onUpdate={handleDraftUpdate} />
            ))}
      </section>

      <section>
        <h2 style={subheading}>Upcoming (next 7 days)</h2>
        <UpcomingList items={upcoming} />
      </section>
    </div>
  );
}

const page: React.CSSProperties = { padding: 32, maxWidth: 900, margin: '0 auto' };
const heading: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' };
const subheading: React.CSSProperties = { fontSize: 17, fontWeight: 600, margin: '0 0 14px', color: '#374151' };
const btnPrimary: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14,
};
