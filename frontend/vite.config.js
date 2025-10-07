import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        // Przekierowuje żądania z /api na serwer backendu
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3003',
          changeOrigin: true,
        },
      },
    },
  }
})
