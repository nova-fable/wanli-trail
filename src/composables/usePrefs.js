/**
 * @file 用户偏好持久化（localStorage 单例）
 *
 * 职责：恢复 + 自动落盘全部用户偏好；语言偏好代管（写入 core/i18n 状态）。
 * 数据来源：localStorage（键见 core/constants/storage）。
 * 写路径：initPrefs() 恢复一次；此后 watch 汇聚所有偏好变化统一 write()。
 *
 * 兼容性：结构变化时 bump STORAGE.PREFS 版本（旧键自然废弃）；读不到的键回默认值；
 * try/catch 兼容隐私模式（存储被禁时静默降级为内存态）。
 */
import { ref, watch } from 'vue'
import { playback } from './usePlayback'
import { armyVisible, situationVisible } from './useLayers'
import { STORAGE } from '../core/constants/storage'
import { MARKER_MODE } from '../core/enums'
import { useI18n, initI18n } from '../core/i18n'

/** 图例折叠状态（ArmyLegend 与持久化共用；不属播放引擎故独立于此） */
export const legendCollapsed = ref(false)

const { lang: langState } = useI18n()

/** 读取整包偏好；解析失败视为空（旧/坏数据兜底） */
function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.PREFS) || '{}')
  } catch {
    return {}
  }
}

/** 全量写盘；隐私模式/存储被禁时静默忽略 */
function write() {
  try {
    localStorage.setItem(
      STORAGE.PREFS,
      JSON.stringify({
        basemap: playback.basemap,
        speed: playback.speed,
        autoTour: playback.autoTour,
        follow: playback.follow,
        markerMode: playback.markerMode,
        legendCollapsed: legendCollapsed.value,
        lang: langState.lang,
        armyVisible: { ...armyVisible },
        situationVisible: { ...situationVisible },
      }),
    )
  } catch {
    /* 静默降级 */
  }
}

/**
 * 恢复全部偏好并挂自动落盘监听。
 * 必须在子组件挂载前调用（App setup 期），否则子组件首帧读不到恢复值。
 */
export function initPrefs() {
  const p = read()
  if (typeof p.basemap === 'string') playback.basemap = p.basemap
  if (typeof p.speed === 'number') playback.speed = p.speed
  if (typeof p.autoTour === 'boolean') playback.autoTour = p.autoTour
  if (typeof p.follow === 'boolean') playback.follow = p.follow
  if (p.markerMode === MARKER_MODE.MARCH || p.markerMode === MARKER_MODE.ALL) {
    playback.markerMode = p.markerMode
  }
  if (typeof p.legendCollapsed === 'boolean') legendCollapsed.value = p.legendCollapsed
  if (typeof p.lang === 'string') initI18n(p.lang)
  if (p.armyVisible) {
    for (const k of Object.keys(armyVisible)) {
      if (typeof p.armyVisible[k] === 'boolean') armyVisible[k] = p.armyVisible[k]
    }
  }
  if (p.situationVisible) {
    for (const k of Object.keys(situationVisible)) {
      if (typeof p.situationVisible[k] === 'boolean') situationVisible[k] = p.situationVisible[k]
    }
  }
  // 汇聚所有偏好来源的变更，统一落盘（数组源的浅拷贝保证深层布尔变化可被追踪）
  watch(
    () => [
      playback.basemap,
      playback.speed,
      playback.autoTour,
      playback.follow,
      playback.markerMode,
      legendCollapsed.value,
      langState.lang,
      { ...armyVisible },
      { ...situationVisible },
    ],
    write,
  )
}
