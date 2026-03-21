import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import CalendarImportPage from './pages/CalendarImportPage';
import ContactFormPage from './pages/ContactFormPage';
import ContactsPage from './pages/ContactsPage';
import DashboardPage from './pages/DashboardPage';
import DetectionsPage from './pages/DetectionsPage';
import TargetsPage from './pages/TargetsPage';
import HistoryPage from './pages/HistoryPage';
import CalendarPage from './pages/CalendarPage';
import BroadcastsPage from './pages/BroadcastsPage';
import BroadcastDetailPage from './pages/BroadcastDetailPage';
import SettingsPage from './pages/SettingsPage';
import ProfileSelectionPage from './pages/ProfileSelectionPage';
import { ProfileProvider, useProfile } from './context/ProfileContext';

function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  if (!profile) return <Navigate to="/profiles" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ProfileProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/profiles" element={<ProfileSelectionPage />} />
          <Route
            element={
              <ProfileGuard>
                <AppShell />
              </ProfileGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/new" element={<ContactFormPage />} />
            <Route path="/contacts/import" element={<CalendarImportPage />} />
            <Route path="/contacts/:id/edit" element={<ContactFormPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/broadcasts" element={<BroadcastsPage />} />
            <Route path="/broadcasts/:id" element={<BroadcastDetailPage />} />
            <Route path="/detections" element={<DetectionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProfileProvider>
  );
}
