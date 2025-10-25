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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Dodajemy brakujący stan
  const hasVerified = React.useRef(false); // Ref to prevent double-execution in StrictMode

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
        // W starym systemie, sam fakt posiadania tokenu i danych użytkownika wystarczał.
        // Weryfikacja odbywa się przy każdym zapytaniu do API.
        if (user) {
          setIsAuthenticated(true); // Ustawiamy stan uwierzytelnienia
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]); // Dependency array is correct

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      setIsAuthenticated(true);
      return newUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Rzucamy błąd dalej, aby formularz logowania mógł go obsłużyć
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setIsAuthenticated(false);
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
    isAuthenticated,
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