import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import Dashboard from './pages/Dashboard';
import HomeView from './pages/dashboard/HomeView';
import AgendaView from './pages/dashboard/AgendaView';
import KlantenView from './pages/dashboard/KlantenView';
import TakenView from './pages/dashboard/TakenView';
import ArchiefView from './pages/dashboard/ArchiefView';
import WorkspaceView from './pages/dashboard/WorkspaceView';
import PulseView from './pages/dashboard/PulseView';
import VideoCheckerView from './pages/dashboard/VideoCheckerView';
import Portal from './pages/Portal';
import LoginPage from './pages/LoginPage';
import { DASHBOARD_BASE } from './paths';
import './styles/global.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

function FullScreenBrand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontFamily: 'Montserrat', fontSize: '24px', fontWeight: '600', color: 'var(--accent)' }}>4REEL</div>
    </div>
  );
}

function TeamOnlyRoute({ user, children }) {
  if (user?.role !== 'team') {
    return <Navigate to="/portaal" replace />;
  }
  return children;
}

function TeamSectionRoute({ user, allow, children }) {
  if (user?.role !== 'team') return <Navigate to="/portaal" replace />;
  const teamAccessLevel = user?.teamAccessLevel || 'editor';
  if (!allow.includes(teamAccessLevel)) return <Navigate to={`${DASHBOARD_BASE}/workspace`} replace />;
  return children;
}

/** `/login`: show form when logged out; send logged-in users to the right app area. */
function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenBrand />;
  if (user?.role === 'client') return <Navigate to="/portaal" replace />;
  if (user?.role === 'team') {
    const teamAccessLevel = user?.teamAccessLevel || 'editor';
    return (
      <Navigate
        to={teamAccessLevel === 'admin' ? DASHBOARD_BASE : `${DASHBOARD_BASE}/workspace`}
        replace
      />
    );
  }
  return <LoginPage />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenBrand />;
  const role = user?.role;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/portaal/*" element={<Portal />} />
      <Route
        path={`${DASHBOARD_BASE}/*`}
        element={role === 'client' ? <Navigate to="/portaal" replace /> : <Dashboard />}
      >
        <Route
          index
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <HomeView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="agenda"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <AgendaView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="klanten"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <KlantenView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="klanten/:clientId"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <KlantenView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="taken"
          element={(
            <TeamSectionRoute user={user} allow={['admin', 'editor']}>
              <TakenView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="archief"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <ArchiefView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="workspace"
          element={(
            <TeamOnlyRoute user={user}>
              <WorkspaceView />
            </TeamOnlyRoute>
          )}
        />
        <Route
          path="workspace/:batchId"
          element={(
            <TeamOnlyRoute user={user}>
              <WorkspaceView />
            </TeamOnlyRoute>
          )}
        />
        <Route
          path="checker"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <VideoCheckerView />
            </TeamSectionRoute>
          )}
        />
        <Route
          path="pulse"
          element={(
            <TeamSectionRoute user={user} allow={['admin']}>
              <PulseView />
            </TeamSectionRoute>
          )}
        />
        <Route path="*" element={<Navigate to={DASHBOARD_BASE} replace />} />
      </Route>
      <Route path="/" element={<Navigate to={role === 'client' ? '/portaal' : DASHBOARD_BASE} replace />} />
      <Route path="*" element={<Navigate to={role === 'client' ? '/portaal' : DASHBOARD_BASE} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <LangProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
