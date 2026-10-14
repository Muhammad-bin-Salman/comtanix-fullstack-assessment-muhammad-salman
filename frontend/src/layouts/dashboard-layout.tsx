import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { formatLabel } from '../utils/format';

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Comtanix</p>
          <h1>Quote Request Dashboard</h1>
        </div>
        <div className="user-menu">
          <div className="user-summary">
            <span>{user?.name}</span>
            <span className={`role-badge role-${user?.role}`}>{formatLabel(user?.role ?? '')}</span>
          </div>
          <button className="button button-secondary" type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}
