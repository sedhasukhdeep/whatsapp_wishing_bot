import type { DraftStatus } from '../../types';

const COLORS: Record<DraftStatus, string> = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  sent: '#10b981',
  skipped: '#9ca3af',
};

const LABELS: Record<DraftStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  sent: 'Sent',
  skipped: 'Skipped',
};

export default function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span
      style={{
        background: COLORS[status],
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {LABELS[status]}
    </span>
  );
}
