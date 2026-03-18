import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DashboardUpcomingItem } from '../../types';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function occasionLabel(item: DashboardUpcomingItem) {
  const { occasion, turning_age, years_together } = item;
  if (occasion.type === 'birthday') return turning_age ? `Birthday (turning ${turning_age})` : 'Birthday';
  if (occasion.type === 'anniversary') return years_together ? `Anniversary (${years_together} years)` : 'Anniversary';
  return occasion.label || 'Special Occasion';
}

export default function UpcomingList({ items }: { items: DashboardUpcomingItem[] }) {
  if (!items.length) {
    return <p className="text-muted-foreground text-sm">No upcoming occasions in the next 7 days.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Occasion</TableHead>
            <TableHead>In</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.occasion.id}>
              <TableCell className="text-muted-foreground">
                {MONTHS[item.occasion.month]} {item.occasion.day}
              </TableCell>
              <TableCell className="font-medium">{item.contact.name}</TableCell>
              <TableCell>{occasionLabel(item)}</TableCell>
              <TableCell className="text-muted-foreground">
                {item.days_away === 1 ? 'Tomorrow' : `${item.days_away} days`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
