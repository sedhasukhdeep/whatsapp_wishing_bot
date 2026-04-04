import { useEffect, useState } from 'react';
import { getDraftHistory } from '../api/client';
import type { DraftHistoryItem } from '../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth() + 1]} ${d.getDate()}, ${d.getFullYear()}`;
}

function occasionDisplay(item: DraftHistoryItem): string {
  if (item.occasion.type === 'birthday') return 'Birthday';
  if (item.occasion.type === 'anniversary') return 'Anniversary';
  return item.occasion.label || 'Special Occasion';
}

export default function HistoryPage() {
  const [history, setHistory] = useState<DraftHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDraftHistory()
      .then(setHistory)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 md:p-8 text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-4 md:p-8 text-destructive">{error}</div>;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6">Sent Messages History</h1>

      {history.length === 0 ? (
        <p className="text-muted-foreground text-sm">No sent messages yet.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Occasion</TableHead>
                <TableHead>Date Sent</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.contact.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.contact.relationship_label || item.contact.relationship}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {occasionDisplay(item)}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(item.occasion_date)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.sent_at)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {item.final_text ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm truncate cursor-default">{item.final_text}</p>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm whitespace-pre-wrap text-xs">
                          {item.final_text}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                    {item.gif_url && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">GIF</Badge>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
