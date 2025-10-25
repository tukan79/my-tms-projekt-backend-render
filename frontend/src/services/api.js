import axios from 'axios';

// OSTATECZNA POPRAWKA: Dynamiczne tworzenie adresu URL API.
// Używamy adresu IP, z którego serwowany jest frontend, ale zmieniamy port na 3000 dla backendu.
// To rozwiązanie działa zarówno na localhost, jak i w sieci lokalnej bez potrzeby używania .env.
const apiHost = `${window.location.protocol}//${window.location.hostname}:3000`;
const baseURL = import.meta.env.VITE_API_BASE_URL || apiHost;


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
