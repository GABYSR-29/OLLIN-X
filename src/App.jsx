import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Simulator from './components/Simulator';
import ProtectedRoute from './components/ProtectedRoute';

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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingOrRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/simulator"
          element={
            <ProtectedRoute>
              <Simulator />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
