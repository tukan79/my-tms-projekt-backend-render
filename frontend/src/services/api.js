import axios from 'axios';

// Ustawienie bazowego adresu URL dla wszystkich zapytań
// Zmienna VITE_API_BASE_URL jest ustawiana w pliku .env w głównym katalogu projektu
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL,
  timeout: 10000,
});

// Dodajemy "interceptor", który będzie przechwytywał każde zapytanie
// i dodawał do niego nagłówek autoryzacyjny z tokenem.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Jeśli serwer odpowie statusem 401 lub 403, oznacza to problem z autoryzacją.
    if (error.response && [401, 403].includes(error.response.status)) {
      // Usuwamy nieprawidłowy token i dane użytkownika.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Przekierowujemy na stronę logowania, aby użytkownik mógł się ponownie zalogować.
      // Sprawdzamy, czy już nie jesteśmy na stronie logowania, aby uniknąć pętli przekierowań.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
