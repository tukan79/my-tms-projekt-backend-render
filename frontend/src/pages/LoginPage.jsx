import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext.jsx';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // Dodano brakujący stan błędu
  const { login, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Usunięto wywołanie `setError(null)` - showToast jest wystarczające
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed. Please check your credentials.';
      showToast(errorMessage, 'error');
      setPassword('');
      emailInputRef.current?.focus();
      console.error("Login error:", err);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ref={emailInputRef} // Przypisz ref do inputa
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;