import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/dashboard-layout';
import { LoginPage } from './pages/login-page';
import { QuoteListPage } from './pages/quote-list-page';
import { QuoteDetailPage } from './pages/quote-detail-page';
import { ProtectedRoute } from './routes/protected-route';
import { PublicOnlyRoute } from './routes/public-only-route';

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/quotes" element={<QuoteListPage />} />
          <Route path="/quotes/:quoteId" element={<QuoteDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/quotes" replace />} />
    </Routes>
  );
}
