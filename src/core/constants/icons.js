/**
 * @file 标记图标常量（Leaflet divIcon 的几何参数单源）
 *
 * 数据来源：事件类型与部队配色来自 src/mock（EVENT_TYPES / ARMIES），
 * 本文件只收图标画布与锚点，不含业务数据。
 * 写路径：被 map/icons.js 的图标工厂组装进 L.divIcon；样式钩子类
 * （.walker / .ev-mark / .kmt-flag / .jp-mark / .story-mark）在 styles/map.css。
 */

/**
 * 事件地点符号的七种轮廓（手绘军用地图符号，不规则图形 + 半透明填充）
 * 键 = 事件类型（见 src/mock 的 EVENT_TYPES）；
 * size 画布 / anchor 锚点（尖端即事件坐标）/ tx,ty 徽记单字中心
 * （星形不置字，取缺省不渲文字）/ art 轮廓 SVG 片段（fill 走 .ev-plate/.ev-star 样式）
 */
export const EV_SHAPES = {
  depart: {
    size: [34, 44], anchor: [9, 42], tx: 13.5, ty: 15.6,
    art: `<line class="ev-pole" x1="9" y1="41" x2="9" y2="4"/>
      <ellipse class="ev-ground" cx="9" cy="41.5" rx="2.4" ry="1"/>
      <path class="ev-plate" d="M10 4 L30 11.5 L10 19 Z"/>`,
  },
  battle: {
    size: [30, 31], anchor: [15, 29], tx: 15, ty: 15.5,
    art: `<path class="ev-plate" d="M2 3 h26 v9 c0 8 -8 13.5 -13 17 c-5 -3.5 -13 -9 -13 -17 z"/>`,
  },
  meeting: {
    size: [30, 30], anchor: [15, 28], tx: 15, ty: 19.5,
    art: `<path class="ev-plate" d="M8 2 h14 l6 6 v14 l-6 6 h-14 l-6 -6 v-14 z"/>`,
  },
  join: {
    size: [30, 30], anchor: [15, 27.5],
    art: `<path class="ev-star" d="M15 1.5 L18.41 10.81 L28.31 11.17 L20.52 17.29 L23.23 26.83 L15 21.3 L6.77 26.83 L9.48 17.29 L1.69 11.17 L11.59 10.81 Z"/>`,
  },
  pass: {
    size: [32, 30], anchor: [16, 27], tx: 16.5, ty: 24.5,
    art: `<path class="ev-plate" d="M1 27 L10.5 9 L15.5 17 L21 5 L31 27 Z"/>`,
  },
  arrive: {
    size: [28, 33], anchor: [14, 31.5], tx: 14, ty: 15.5,
    art: `<path class="ev-plate" d="M14 1 c7.2 0 13 5.4 13 12 c0 8.6 -8.4 14.6 -13 18.5 c-4.6 -3.9 -13 -9.9 -13 -18.5 c0 -6.6 5.8 -12 13 -12 z"/>`,
  },
  base: {
    size: [30, 31], anchor: [15, 31], tx: 15, ty: 18.5,
    art: `<path class="ev-plate" d="M3 9 V26 L15 31 L27 26 V9 H22 V4 H17.5 V9 H12.5 V4 H8 V9 Z"/>`,
  },
}

/**
 * 行军小红军图标：SVG 组合人物的画布与锚点。
 * SVG 视框固定 34×42，画布放宽到 70×88 容纳行军旗与臂章；
 * 锚点落在人物脚下而非画布中心，否则标记会浮在路线之上。
 */
export const WALKER_ICON = {
  SIZE: [70, 88],
  ANCHOR: [35, 74],
}
