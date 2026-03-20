import { Badge } from '@/components/ui/badge';
import type { DraftStatus } from '../../types';

const VARIANT_MAP: Record<DraftStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  approved: 'default',
  sent: 'secondary',
  skipped: 'outline',
  scheduled: 'outline',
};

const LABELS: Record<DraftStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  sent: 'Sent',
  skipped: 'Skipped',
  scheduled: 'Scheduled',
};

const COLOR_CLASS: Record<DraftStatus, string> = {
  pending: 'border-amber-500 text-amber-600 dark:text-amber-400',
  approved: 'bg-blue-600 text-white border-blue-600',
  sent: 'bg-emerald-600 text-white border-emerald-600',
  skipped: 'border-muted-foreground text-muted-foreground',
  scheduled: 'border-purple-500 text-purple-600 dark:text-purple-400',
};

export default function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <Badge variant={VARIANT_MAP[status]} className={COLOR_CLASS[status]}>
      {LABELS[status]}
    </Badge>
  );
}
