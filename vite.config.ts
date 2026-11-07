import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8008'
const publicOrigin = process.env.CW_PUBLIC_ORIGIN || 'http://127.0.0.1:8814'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8814,
    strictPort: true,
    allowedHosts: [new URL(publicOrigin).hostname],
    proxy: {
      '/api': apiTarget,
      '/courses': apiTarget,
      '/health': apiTarget,
    },
  },
})
