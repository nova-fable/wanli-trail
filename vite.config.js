import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相对资源路径：dist 可部署在任意子路径（GitHub Pages / 静态服务器目录），
  // 避免绝对 /assets 404 导致启动屏永久停留
  base: './',
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
