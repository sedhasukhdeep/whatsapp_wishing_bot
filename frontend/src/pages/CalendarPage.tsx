import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCalendarOccasions } from '../api/client';
import type { CalendarDay, CalendarOccasionEntry } from '../types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TYPE_COLORS: Record<string, string> = {
  birthday: 'bg-blue-500',
  anniversary: 'bg-pink-500',
  custom: 'bg-amber-500',
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // Returns 0=Monday ... 6=Sunday
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7; // JS Sunday=0; shift to Monday=0
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedOccasions, setSelectedOccasions] = useState<CalendarOccasionEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    setLoading(true);
    getCalendarOccasions(month, year)
      .then(setDays)
      .finally(() => setLoading(false));
  }, [month, year]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function openDay(day: number, occasions: CalendarOccasionEntry[]) {
    setSelectedDay(day);
    setSelectedOccasions(occasions);
    setSheetOpen(true);
  }

  const dayMap = new Map<number, CalendarOccasionEntry[]>();
  days.forEach((d) => dayMap.set(d.day, d.occasions));

  const firstDayOffset = getFirstDayOfMonth(year, month);
  const totalDays = getDaysInMonth(year, month);
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  // Build grid cells: blank + days
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <span className="font-semibold min-w-32 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
            {cells.map((day, idx) => {
              const occasions = day ? (dayMap.get(day) ?? []) : [];
              return (
                <div
                  key={idx}
                  onClick={() => day && occasions.length > 0 && openDay(day, occasions)}
                  className={cn(
                    'bg-background min-h-16 p-1.5',
                    day && occasions.length > 0 && 'cursor-pointer hover:bg-accent',
                    !day && 'bg-muted/30',
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        'w-6 h-6 flex items-center justify-center text-xs rounded-full mb-1',
                        today === day && 'bg-primary text-primary-foreground font-bold'
                      )}>
                        {day}
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {occasions.slice(0, 3).map((occ, i) => (
                          <span
                            key={i}
                            className={cn('w-1.5 h-1.5 rounded-full', TYPE_COLORS[occ.type] ?? 'bg-muted-foreground')}
                            title={`${occ.contact_name}: ${occ.type}`}
                          />
                        ))}
                        {occasions.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{occasions.length - 3}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Birthday</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" />Anniversary</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Custom</span>
          </div>
        </>
      )}

      {/* Day detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {MONTH_NAMES[month - 1]} {selectedDay}, {year}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {selectedOccasions.map((occ) => (
              <div key={occ.occasion_id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                <div>
                  <div className="font-medium text-sm">{occ.contact_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                      TYPE_COLORS[occ.type] ?? 'bg-muted-foreground'
                    )} />
                    {occ.label || occ.type}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 shrink-0"
                  onClick={() => nav(`/contacts/${occ.contact_id}/edit`)}
                >
                  Edit Contact
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
