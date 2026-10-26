import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.css'

try {
  createApp(App).mount('#app')
  // Vue 挂载是同步的，立即移除 index.html 的预置启动屏；
  // 不能用 rAF 门控：IAB/遮挡环境下 rAF 会被系统暂停，启动屏将永久残留
  document.getElementById('boot')?.remove()
} catch (err) {
  const tip = document.querySelector('#boot .b-tip')
  if (tip) tip.textContent = '加载失败，请刷新页面或查看控制台'
  throw err
}
