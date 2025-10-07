import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api'; // Import the configured axios instance

const AuthContext = createContext(null);

// Dedykowany hak do używania kontekstu autoryzacji
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const hasVerified = React.useRef(false); // Ref to prevent double-execution in StrictMode

  // Funkcja pomocnicza do zarządzania udanym uwierzytelnieniem
  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  useEffect(() => {
    const verifyToken = async () => {
      // In React's StrictMode, effects run twice in development.
      // This check prevents the verification API call from being made a second time.
      if (hasVerified.current) {
        return;
      }
      hasVerified.current = true;

      if (token) {
        // Interceptor w api.js automatycznie obsłuży błąd 401/403 i wyloguje użytkownika.
        try {
          const response = await api.get('/api/auth/verify');
          handleAuthSuccess(token, response.data.user);
        } catch (error) {
          // Token is invalid, logout
          logout();
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]); // Dependency array is correct

  const login = async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { token: newToken, user: newUser } = response.data;
    handleAuthSuccess(newToken, newUser);
    return newUser;
  };

  const register = async (email, password) => {
    const response = await api.post('/api/auth/register', { email, password });
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    login,
    logout,
    register,
    isAuthenticated: !!token,
    loading,
    api,
  };

  // Do not render children until the initial loading (token verification) is complete.
  // This prevents rendering the app in a temporary unauthenticated state.
  return (
    <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
  );
};

export default AuthContext;