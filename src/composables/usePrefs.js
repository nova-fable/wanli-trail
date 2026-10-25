import { ref, watch } from 'vue'
import { playback } from './usePlayback'
import { armyVisible, situationVisible } from './useLayers'

// 用户偏好持久化：底图/倍速/讲解与跟随开关/图层显隐/图例折叠
const KEY = 'cz-prefs-v1'

export const legendCollapsed = ref(false)

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        basemap: playback.basemap,
        speed: playback.speed,
        autoTour: playback.autoTour,
        follow: playback.follow,
        legendCollapsed: legendCollapsed.value,
        armyVisible: { ...armyVisible },
        situationVisible: { ...situationVisible },
      }),
    )
  } catch {
    /* 隐私模式/存储被禁用时静默忽略 */
  }
}

// 在子组件挂载前调用一次：先恢复偏好，此后任何变化自动落盘
export function initPrefs() {
  const p = read()
  if (typeof p.basemap === 'string') playback.basemap = p.basemap
  if (typeof p.speed === 'number') playback.speed = p.speed
  if (typeof p.autoTour === 'boolean') playback.autoTour = p.autoTour
  if (typeof p.follow === 'boolean') playback.follow = p.follow
  if (typeof p.legendCollapsed === 'boolean') legendCollapsed.value = p.legendCollapsed
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
  watch(
    () => [
      playback.basemap,
      playback.speed,
      playback.autoTour,
      playback.follow,
      legendCollapsed.value,
      { ...armyVisible },
      { ...situationVisible },
    ],
    write,
  )
}
