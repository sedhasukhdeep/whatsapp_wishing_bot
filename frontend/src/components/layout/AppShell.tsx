import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/contacts', label: 'Contacts', icon: '👥' },
  { to: '/targets', label: 'WhatsApp', icon: '💬' },
];

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={sidebar}>
        <div style={brand}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Wishing Bot</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Never miss an occasion</div>
          </div>
        </div>

        <div style={{ padding: '8px 0' }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              style={({ isActive }) => ({
                ...navLink,
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#2563eb' : '#374151',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <span style={{ fontSize: 16, width: 20 }}>{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Quick links</div>
          <NavLink
            to="/contacts/import"
            style={{ ...navLink, fontSize: 12, color: '#6b7280', padding: '6px 10px' }}
          >
            <span style={{ fontSize: 14 }}>📅</span> Import Calendar
          </NavLink>
        </div>
      </nav>

      <main style={{ flex: 1, overflow: 'auto', background: '#f9fafb' }}>
        <Outlet />
      </main>
    </div>
  );
}

const sidebar: React.CSSProperties = {
  width: 220, background: '#fff', borderRight: '1px solid #e5e7eb',
  display: 'flex', flexDirection: 'column', flexShrink: 0,
};
const brand: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '20px 16px', borderBottom: '1px solid #e5e7eb',
};
const navLink: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px', textDecoration: 'none',
  fontSize: 14, borderRadius: 6, margin: '2px 8px', transition: 'background 0.1s',
};
