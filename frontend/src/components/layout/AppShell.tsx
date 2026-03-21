import {
  CalendarDays,
  HelpCircle,
  History,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Radar,
  Radio,
  Settings,
  Sun,
  Users,
  UserCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useTheme } from './ThemeProvider';
import OnboardingWizard from '@/components/OnboardingWizard';
import { getDetectionsCount } from '@/api/client';
import { useProfile } from '@/context/ProfileContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', Icon: Users },
  { to: '/targets', label: 'WhatsApp', Icon: MessageSquare },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/history', label: 'History', Icon: History },
  { to: '/broadcasts', label: 'Broadcasts', Icon: Radio },
  { to: '/detections', label: 'Detections', Icon: Radar },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { profile, setProfile } = useProfile();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [pendingDetections, setPendingDetections] = useState(0);

  useEffect(() => {
    const refresh = () => getDetectionsCount().then((r) => setPendingDetections(r.count)).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <nav className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-card">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            W
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm leading-tight">Wishing Bot</div>
            <div className="text-xs text-muted-foreground mt-0.5">Never miss an occasion</div>
          </div>
        </div>

        {/* Profile indicator */}
        {profile && (
          <button
            onClick={() => { setProfile(null); navigate('/profiles', { replace: true }); }}
            className="flex items-center gap-2 px-4 py-2 border-b border-border hover:bg-accent transition-colors w-full text-left"
            title="Switch profile"
          >
            <UserCircle size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{profile.name}</span>
            <span className="text-xs text-muted-foreground/60">switch</span>
          </button>
        )}

        {/* Navigation */}
        <div className="flex-1 py-2 overflow-y-auto">
          {navLinks.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {to === '/detections' && pendingDetections > 0 && (
                <span className="ml-auto text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {pendingDetections}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Footer: theme toggle + quick links */}
        <div className="border-t border-border p-3 space-y-3">
          <NavLink
            to="/contacts/import"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <CalendarDays size={12} />
            Import Calendar
          </NavLink>
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 w-full"
          >
            <HelpCircle size={12} />
            How to use
          </button>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'dark' ? 'Dark' : 'Light'} mode
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-auto bg-background">
        <Outlet context={{ openTour: () => setShowTour(true) }} />
      </main>

      {showTour && <OnboardingWizard onDismiss={() => setShowTour(false)} />}
    </div>
  );
}
