import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/AuthContext.jsx';
import AppLayout from './layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import { navItems } from './routes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/departments" replace />} />
        {navItems.map((item) => (
          <Route key={item.path} path={item.path} element={item.element ?? <PlaceholderPage item={item} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
