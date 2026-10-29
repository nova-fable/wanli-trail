/**
 * @file 播放引擎常量（时间推进与跟随镜头视角档）
 *
 * 引擎为 setInterval 驱动（遮挡环境可用）：tick 间隔决定渲染粒度，
 * dt 限幅与跳帧防护见 composables/usePlayback.js 的 tick；
 * 跟随缩放按倍速取档，倍速越高行军越快、视野越广，避免地图疯狂滚动。
 */

/** 播放引擎：1× 速率 = 每秒推进天数；tick 间隔与限幅（见 usePlayback） */
export const PLAYBACK = {
  DAYS_PER_SEC: 7,
  TICK_MS: 50,
  MAX_DT_MS: 2000,
  SKIP_DT_MS: 5000,
}

/** 跟随镜头目标缩放（键为倍速档位，见 map/camera.js 的 followZoomFor） */
export const FOLLOW = {
  ZOOMS: { 0.5: 6, 1: 6, 2: 5, 4: 4 },
}

/** 三维主视图的部队聚焦视角与飞行时长 */
export const TERRAIN_FOLLOW = {
  FOCUS_ZOOM: 7.2,
  FOCUS_MS: 2400,
  UPDATE_MS: 1400,
  EASE_MS: 1500,
}
