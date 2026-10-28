/**
 * @file 地图几何常量（跨模块单源）
 *
 * 约定：凡同时出现在 JS 与 CSS 的几何/尺寸约定，以本文件为 JS 侧单源；
 * CSS 侧对应值写在 styles/ 同名域的样式分片相邻注释处，两者同值。
 * 本文件只收地图视野与视口预留；标记轮廓/播放引擎/UI 时长分别在
 * core/constants 的 icons / playback / ui。
 */

/**
 * 初始视野范围（含东北/华北日军威胁标记，经纬度 [minLat, minLng]—[maxLat, maxLng]）
 */
export const MAP_VIEW = {
  /** 经纬度包围盒（fitBounds 用） */
  CHINA_BOUNDS: [
    [23.2, 97.8],
    [42.6, 125.2],
  ],
  /**
   * 地图初始/整体视野的底部预留（px）：为全宽时间带 + 字幕（含诗词双行）让位，
   * 窄屏时间带更矮。CSS 侧同值锚点（改动需同步）：
   * - `narrow: 150` ↔ `styles/responsive.css` 的 `.leaflet-bottom.leaflet-right { bottom: 150px }`
   *   （Leaflet 比例尺抬离时间带）与 `styles/timeline.css` 的 `.timeline-dock` 高度
   * - `wide: 210` 是 JS 侧视野预留，CSS 无对等声明：宽屏下比例尺位置由
   *   `styles/map.css` 的 `.leaflet-bottom.leaflet-right { bottom: 200px }` 单独约定，
   *   两者不要求相等（视野预留算的是地图可视区，控件位置算的是控件自身避让）
   */
  RESERVE: { wide: 210, narrow: 150 },
  /** 窄屏断点（与 styles/responsive.css @media 断点同值）；仅作视口预留档位判据，见 ui.js 文件头 */
  NARROW_BREAKPOINT: 768,
}

/** 已走折线队尾限流阈值（度）：≈1km，低倍率下不可见的滞后上界 */
export const TRAVEL = {
  TAIL_EPS: 0.01,
}

/** 路线方向箭头里程间距（km）：低倍率全国视野大间距，zoom≥DENSE_ZOOM 省级视野加密 */
export const ARROWS = {
  STEP: { FAR: 140, NEAR: 60 },
  /** 箭头密度切换的缩放档位 */
  DENSE_ZOOM: 7,
}
