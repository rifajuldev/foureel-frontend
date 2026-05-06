import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, logout as apiLogout } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  /** Call after a successful `/auth/login` once role and route are validated (avoids redirect race on `/login`). */
  const establishSession = (nextUser) => {
    setUser(nextUser);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Still clear local session if the server is unreachable.
    }
    setUser(null);
  };

  const isTeamUser = user?.role === 'team';
  const teamAccessLevel = isTeamUser ? (user?.teamAccessLevel || 'editor') : null;
  const isTeamAdmin = isTeamUser && teamAccessLevel === 'admin';
  const isTeamEditor = isTeamUser && teamAccessLevel === 'editor';

  const canAccessDashboardSection = (section) => {
    if (!isTeamUser) return false;
    if (isTeamAdmin) return true;
    return section === 'workspace' || section === 'taken';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        establishSession,
        logout,
        isTeamUser,
        isTeamAdmin,
        isTeamEditor,
        canAccessDashboardSection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
