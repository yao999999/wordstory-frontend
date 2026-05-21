import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    host: true, // 允许局域网访问
    allowedHosts: [
      'localhost',
      '.trycloudflare.com', // 允许所有 cloudflare tunnel 域名
      '.cloudflare.com',
      '.ngrok.io',
    ],
  },
})
