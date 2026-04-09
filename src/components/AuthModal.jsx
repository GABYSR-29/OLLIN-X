import { useState, useEffect } from 'react';
import '../styles/auth.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = tab === 'login'
        ? `${API_URL || ''}/api/auth/login`
        : `${API_URL || ''}/api/auth/register`;
      const body = tab === 'login'
        ? { email, password }
        : { name, email, password };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ _id: data._id, name: data.name, email: data.email }));
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Cerrar">
          <i className="fas fa-times"></i>
        </button>
        <div className="auth-tabs">
          <button type="button" className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>
            Iniciar sesión
          </button>
          <button type="button" className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); }}>
            Registrarse
          </button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Nombre</label>
              <input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tu nombre" autoComplete="name" />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@ejemplo.com" autoComplete="email" />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Contraseña</label>
            <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} minLength={6} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin"></i> Procesando...</> : tab === 'login' ? 'Ingresar' : 'Crear cuenta'}
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
