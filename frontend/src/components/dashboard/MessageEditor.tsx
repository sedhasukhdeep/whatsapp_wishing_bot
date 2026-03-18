import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const WA_WARN = 3800;
const WA_LIMIT = 4096;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

export default function MessageEditor({ value, onChange, onRegenerate, regenerating }: Props) {
  const len = value.length;
  const overLimit = len > WA_LIMIT;
  const nearLimit = len > WA_WARN;

  return (
    <div className="space-y-1.5 mb-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className={cn(
          'resize-y text-sm leading-relaxed',
          overLimit && 'border-destructive focus-visible:ring-destructive'
        )}
      />
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs',
            overLimit ? 'text-destructive' : nearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          )}
        >
          {len} / {WA_LIMIT} chars
          {overLimit && ' — exceeds WhatsApp limit'}
          {!overLimit && nearLimit && ' — approaching limit'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>
      </div>
    </div>
  );
}
