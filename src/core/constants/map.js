/**
 * @file 地图渲染常量（跨模块单源）
 *
 * 约定：凡同时出现在 JS 与 CSS 的几何/尺寸约定，以本文件为 JS 侧单源；
 * CSS 侧对应值写在 styles/global.css 相邻注释处，两者同值。
 */

/** 初始视野范围（含东北/华北日军威胁标记，经纬度 [minLat, minLng]—[maxLat, maxLng]） */
export const CHINA_BOUNDS = [
  [23.2, 97.8],
  [42.6, 125.2],
]

/**
 * 跟随镜头目标缩放（按播放倍速取档）：
 * 倍速越高行军越快，视野越广，避免地图疯狂滚动
 */
export const FOLLOW_ZOOMS = { 0.5: 6, 1: 6, 2: 5, 4: 4 }

/** 路线方向箭头里程间距（km）：低倍率全国视野大间距，zoom≥7 省级视野加密 */
export const ARROW_STEP = { FAR: 140, NEAR: 60 }
/** 箭头密度切换的缩放档位 */
export const ARROW_DENSE_ZOOM = 7

/** 已走折线队尾限流阈值（度）：≈1km，低倍率下不可见的滞后上界 */
export const TRAVEL_TAIL_EPS = 0.01

/**
 * 地图初始/整体视野的底部预留（px）：为全宽时间带 + 字幕（含诗词双行）让位，
 * 窄屏时间带更矮，取值与 global.css 的 .timeline-dock 高度约定一致
 */
export const VIEW_RESERVE = { wide: 210, narrow: 150 }
/** 窄屏断点（与 global.css @media 断点同值） */
export const NARROW_BREAKPOINT = 768

/** 播放引擎：1× 速率 = 每秒推进天数；tick 间隔与限幅（见 usePlayback） */
export const PLAYBACK = {
  DAYS_PER_SEC: 7,
  TICK_MS: 50,
  MAX_DT_MS: 2000,
  SKIP_DT_MS: 5000,
}
