import {
  CalendarDays,
  HelpCircle,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Radar,
  Radio,
  Settings,
  Sun,
  Users,
  UserCircle,
  X,
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

function NavContent({
  pendingDetections,
  profile,
  theme,
  toggleTheme,
  setShowTour,
  onNavClick,
  navigate,
  setProfile,
}: {
  pendingDetections: number;
  profile: { name: string } | null;
  theme: string;
  toggleTheme: () => void;
  setShowTour: (v: boolean) => void;
  onNavClick?: () => void;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  setProfile: (p: null) => void;
}) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
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
          onClick={() => {
            setProfile(null);
            navigate('/profiles', { replace: true });
            onNavClick?.();
          }}
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
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 md:py-2.5 mx-2 my-0.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon size={18} className="md:w-4 md:h-4" />
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
          onClick={onNavClick}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          <CalendarDays size={12} />
          Import Calendar
        </NavLink>
        <button
          onClick={() => { setShowTour(true); onNavClick?.(); }}
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
    </>
  );
}

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { profile, setProfile } = useProfile();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [pendingDetections, setPendingDetections] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const refresh = () => getDetectionsCount().then((r) => setPendingDetections(r.count)).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile nav on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileNavOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const navProps = { pendingDetections, profile, theme, toggleTheme, setShowTour, navigate, setProfile };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Desktop sidebar (md+) ─────────────────────────────────────────── */}
      <nav className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-border bg-card">
        <NavContent {...navProps} />
      </nav>

      {/* ── Mobile top bar ────────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            W
          </div>
          <span className="font-bold text-sm">Wishing Bot</span>
          {pendingDetections > 0 && (
            <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
              {pendingDetections}
            </span>
          )}
        </div>
      </div>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          {/* Drawer */}
          <nav className="relative w-72 max-w-[85vw] h-full bg-card flex flex-col border-r border-border overflow-hidden">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <NavContent {...navProps} onNavClick={() => setMobileNavOpen(false)} />
          </nav>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto bg-background pt-14 md:pt-0">
        <Outlet context={{ openTour: () => setShowTour(true) }} />
      </main>

      {showTour && <OnboardingWizard onDismiss={() => setShowTour(false)} />}
    </div>
  );
}
