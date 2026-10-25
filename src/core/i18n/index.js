/**
 * @file i18n 引擎（列式词典，零依赖）
 *
 * 职责：语言状态单例 + t() 取词；词典按"一语言一文件"扩展。
 * 数据来源：./zhCN（基础键源）+ ./en（Partial，缺键回退中文）。
 * 写路径：setLang 只改内存状态；持久化由 usePrefs 代管（watch lang → localStorage）。
 *
 * 响应式说明：state.lang 是 reactive 对象属性，组件渲染期调用 t() 会建立依赖，
 * 切换语言后所有用到 t() 的组件自动重渲染——无需事件广播。
 *
 * 扩展新语言三步：core/enums 的 LANG 加语言码 → 新建 ./<lang>.js（Partial 起步）
 * → DICTS 注册。新增文案键必须先加 zhCN（编译期无强制，靠 review 保证）。
 */
import { reactive } from 'vue'
import { LANG } from '../enums'
import zhCN from './zhCN'
import en from './en'

/** 词典注册表（语言码 → 词典） */
const DICTS = {
  [LANG.ZH_CN]: zhCN,
  [LANG.EN]: en,
}

/** 语言选项（语言切换器渲染用；label 用目标语言自称，不键化） */
export const LANGS = [
  { key: LANG.ZH_CN, label: '中文' },
  { key: LANG.EN, label: 'EN' },
]

/** 当前语言状态（单例） */
const state = reactive({ lang: LANG.ZH_CN })

/**
 * 恢复持久化的语言（usePrefs 初始化时调用）
 * @param {string} saved 已保存语言码；非法值静默忽略
 */
export function initI18n(saved) {
  if (saved && DICTS[saved]) state.lang = saved
}

/**
 * 切换语言（幂等保护由调用方/词典查重兜底）
 * @param {string} lang 目标语言码（LANGS 成员）
 */
export function setLang(lang) {
  if (DICTS[lang]) state.lang = lang
}

/**
 * 取词函数（渲染期调用，自动追踪语言依赖）
 * @param {string} key 词典键（zhCN.js 定义的键名）
 * @param {Record<string, string|number>} [params] 占位符参数，替换 `{name}` 形态
 * @returns {string} 当前语言文案；en 缺键回退中文；键不存在回退键名本身
 */
export function t(key, params) {
  let s = DICTS[state.lang][key] ?? zhCN[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

/** 组件侧统一入口：解构使用（t 为稳定函数引用，可直接解构） */
export function useI18n() {
  return { t, lang: state, setLang, langs: LANGS }
}
