import type { DashboardUpcomingItem } from '../../types';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function occasionLabel(item: DashboardUpcomingItem) {
  const { occasion, turning_age, years_together } = item;
  if (occasion.type === 'birthday') return turning_age ? `Birthday (turning ${turning_age})` : 'Birthday';
  if (occasion.type === 'anniversary') return years_together ? `Anniversary (${years_together} years)` : 'Anniversary';
  return occasion.label || 'Special Occasion';
}

export default function UpcomingList({ items }: { items: DashboardUpcomingItem[] }) {
  if (!items.length) return <p style={{ color: '#9ca3af', fontSize: 14 }}>No upcoming occasions in the next 7 days.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
          <th style={th}>Date</th>
          <th style={th}>Contact</th>
          <th style={th}>Occasion</th>
          <th style={th}>In</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.occasion.id}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={td}>{MONTHS[item.occasion.month]} {item.occasion.day}</td>
            <td style={td}><strong>{item.contact.name}</strong></td>
            <td style={td}>{occasionLabel(item)}</td>
            <td style={td}>{item.days_away === 1 ? 'Tomorrow' : `${item.days_away} days`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, color: '#374151' };
const td: React.CSSProperties = { padding: '10px 12px', color: '#4b5563' };
