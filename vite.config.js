import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5180,
  },
  build: {
    rollupOptions: {
      output: {
        // leaflet 单独分包：数据/样式迭代时不重下发 vendor
        manualChunks: {
          leaflet: ['leaflet'],
        },
      },
    },
  },
})
