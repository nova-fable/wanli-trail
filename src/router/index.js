/**
 * @file 极简 hash 路由（双页面单例）
 *
 * 职责：维护"当前页面名"这一唯一路由状态，驱动 App 在开场页与沙盘页之间切换。
 * 数据来源：location.hash（`#/intro` / `#/sandbox`）。
 * 写路径：navigate() 写 hash → hashchange 事件 → route.name 回流更新。
 *
 * 设计取舍：仅两个页面，引入 vue-router 属过度设计；手写 30 行保持零依赖，
 * 并天然支持深度链接（直接打开 #/sandbox 可跳过开场页进入沙盘）。
 */
import { reactive } from 'vue'

/** 路由名枚举（单源，App 与导航调用方统一引用） */
export const ROUTES = {
  INTRO: 'intro', // 开场页：标题 + 两种模式入口
  SANDBOX: 'sandbox', // 沙盘页：地图 + 播放控制 + 全部浮层
}

/** 从当前 hash 解析路由名；无法识别的值一律回退开场页（非法深链兜底） */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '')
  return h === ROUTES.SANDBOX ? ROUTES.SANDBOX : ROUTES.INTRO
}

/** 当前路由（响应式单例；App 顶层按它条件渲染整页） */
export const route = reactive({ name: parseHash() })

/**
 * 导航到指定页面（幂等：重复导航同页不写 hash）
 * @param {'intro'|'sandbox'} name 目标路由名（ROUTES 成员）
 */
export function navigate(name) {
  if (route.name === name) return
  location.hash = `/${name}` // hashchange 监听器负责回流 route.name
}

/**
 * 初始化路由监听（App 挂载前调用一次）
 * 首帧即同步当前 hash，保证刷新/深链时首个渲染帧就落在正确页面上
 */
export function initRouter() {
  const sync = () => {
    route.name = parseHash()
  }
  window.addEventListener('hashchange', sync)
  sync()
}
