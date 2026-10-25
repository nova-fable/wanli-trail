import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.css'

createApp(App).mount('#app')

// Vue 已接管渲染（开场页/沙盘由路由驱动），移除 index.html 的预置启动屏
// rAF 兜底：遮挡环境下用 setTimeout，确保移除动作不依赖 rAF 存活
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('boot')?.remove(), 60)
})
