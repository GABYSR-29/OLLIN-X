import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiUrl } from '../config/api';
import '../styles/auth.css';

export default function AuthPage() {
  const location = useLocation();
  const isRegisterPath = location.pathname === '/register';
  const [tab, setTab] = useState(isRegisterPath ? 'register' : 'login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setTab(isRegisterPath ? 'register' : 'login');
    setError('');
    setFieldErrors({});
  }, [isRegisterPath]);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/simulator', { replace: true });
    }
  }, [navigate]);

  function validate() {
    const fe = {};
    const em = (email || '').trim();
    if (!em) fe.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) fe.email = 'Email no válido';
    if (!password || password.length < 6) fe.password = 'Mínimo 6 caracteres';
    if (tab === 'register' && !(name || '').trim()) fe.name = 'El nombre es obligatorio';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    const em = email.trim();
    try {
      const url =
        tab === 'login' ? apiUrl('/api/auth/login') : apiUrl('/api/auth/register');
      const body =
        tab === 'login'
          ? { email: em, password }
          : { name: name.trim(), email: em, password };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Respuesta inválida del servidor');
      }
      if (!res.ok) throw new Error(data.message || 'Error al autenticar');
      localStorage.setItem('token', data.token);
      localStorage.setItem(
        'user',
        JSON.stringify({ _id: data._id, name: data.name, email: data.email })
      );
      navigate('/simulator', { replace: true });
    } catch (err) {
      setError(err.message || 'Error de conexión. ¿Está el backend en marcha?');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = apiUrl('/api/auth/google');
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <Link to="/" className="auth-back">
          <i className="fas fa-arrow-left"></i> Volver al inicio
        </Link>

        <div className="auth-tabs auth-tabs-row">
          <button
            type="button"
            className={tab === 'login' ? 'active' : ''}
            onClick={() => {
              setTab('login');
              navigate('/login', { replace: true });
              setError('');
              setFieldErrors({});
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={tab === 'register' ? 'active' : ''}
            onClick={() => {
              setTab('register');
              navigate('/register', { replace: true });
              setError('');
              setFieldErrors({});
            }}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {tab === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Nombre</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && <span className="auth-field-error">{fieldErrors.name}</span>}
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password && (
              <span className="auth-field-error">{fieldErrors.password}</span>
            )}
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Procesando...
              </>
            ) : tab === 'login' ? (
              'Iniciar sesión'
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>o</span>
        </div>
        <button type="button" className="auth-google" onClick={handleGoogle}>
          <i className="fab fa-google"></i> Continuar con Google
        </button>
      </div>
    </div>
  );
}
