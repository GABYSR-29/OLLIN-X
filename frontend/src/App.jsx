import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Landing from './components/Landing';
import AuthPage from './components/AuthPage';
import Simulator from './components/Simulator';
import ProtectedRoute from './components/ProtectedRoute';

/** Solo desarrollo: confirma montaje de la app (quitar si molesta en consola). */
function useDevMountLog() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[OllinX dev] App montada', Date.now());
    }
  }, []);
}

function LandingOrRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      const u = params.get('user');
      if (u) {
        try {
          const userData = JSON.parse(decodeURIComponent(u));
          localStorage.setItem('user', JSON.stringify(userData));
        } catch {}
      } else {
        localStorage.setItem('user', JSON.stringify({ name: 'Usuario', email: '' }));
      }
      window.history.replaceState({}, '', '/');
      navigate('/simulator', { replace: true });
    }
  }, [location.search, navigate]);

  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/simulator" replace />;
  }

  return <Landing />;
}

export default function App() {
  useDevMountLog();

  return (
    <div className="app-shell">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingOrRedirect />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route
            path="/simulator"
            element={
              <div className="route-fill">
                <ProtectedRoute>
                  <Simulator />
                </ProtectedRoute>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
