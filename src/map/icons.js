/**
 * @file Leaflet 图标工厂（地图内全部点标记的视觉定义）
 *
 * 职责：walkerIcon / eventIcon / enemyIcon / japanIcon / storyIcon 五类 divIcon 的
 * SVG 组装；几何形状常量 EV_SHAPES 也在此（形状属图标域，不进 core/constants）。
 * 数据来源：EVENT_TYPES（类型徽记 mark/color）、ARMIES（部队配色）。
 * 写路径：纯函数返回 L.divIcon，由 SandboxMap 组装进图层；样式钩子
 * （.walker / .ev-mark / .kmt-flag / .jp-mark / .story-mark）在 styles/global.css。
 */
import L from 'leaflet'
import { EVENT_TYPES } from '../data/events'

/**
 * 事件地点符号的七种轮廓（手绘军用地图符号，不规则图形 + 半透明填充）
 * 键 = 事件类型；size 画布 / anchor 锚点（尖端即事件坐标）/ tx,ty 徽记单字中心
 * （星形不置字）/ art 轮廓 SVG 片段（fill 走 .ev-plate/.ev-star 样式）
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
 * 行军小红军图标：SVG 组合人物（帽徽/背包/行军旗/四肢）+ 部队臂章；
 * 四肢与躯干的动画钩子类（walking/done/w-lean）由 SandboxMap.render 逐帧驱动
 * @param {object} army ARMIES 成员（color/short）
 */
export function walkerIcon(army) {
  return L.divIcon({
    className: '',
    html: `<div class="walker" style="--ac:${army.color}">
      <div class="w-lean"><div class="w-figure">
        <svg viewBox="0 0 34 42" width="34" height="42" aria-hidden="true">
          <ellipse class="w-shadow" cx="14" cy="39" rx="8" ry="2.4"/>
          <line class="w-pole" x1="23" y1="3" x2="23" y2="17"/>
          <path class="w-flag" d="M23 3 L32 6 L23 9 Z"/>
          <circle class="w-head" cx="13" cy="8.5" r="4.4"/>
          <path class="w-cap" d="M8.2 8.1 a4.8 4.8 0 0 1 9.6 0 Z"/>
          <circle class="w-star" cx="13" cy="6" r="1"/>
          <path class="w-pack" d="M6.5 14 h3.5 v7 h-3.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-4 a1.5 1.5 0 0 1 1.5 -1.5 Z"/>
          <path class="w-body" d="M10.5 13 h6 l1.6 9 h-9.2 Z"/>
          <line class="w-arm w-arm-f" x1="12" y1="15" x2="18.5" y2="18"/>
          <line class="w-arm w-arm-b" x1="12" y1="15" x2="16" y2="20"/>
          <line class="w-leg w-leg-f" x1="13" y1="21.5" x2="16.5" y2="29.5"/>
          <line class="w-leg w-leg-b" x1="13" y1="21.5" x2="9.5" y2="29.5"/>
        </svg>
      </div></div>
      <span class="w-badge">${army.short}</span>
    </div>`,
    iconSize: [70, 88],
    iconAnchor: [35, 74],
  })
}

/**
 * 事件地点图标：按类型取轮廓 + 类型色 + 徽记单字
 * @param {object} ev EVENTS 成员（type → EV_SHAPES/EVENT_TYPES）
 */
export function eventIcon(ev) {
  const meta = EVENT_TYPES[ev.type]
  const s = EV_SHAPES[ev.type] || EV_SHAPES.battle
  const text = s.tx == null ? '' : `<text x="${s.tx}" y="${s.ty}">${meta.mark}</text>`
  return L.divIcon({
    className: '',
    html: `<div class="ev-mark" style="--ec:${meta.color}"><svg viewBox="0 0 ${s.size[0]} ${s.size[1]}" width="${s.size[0]}" height="${s.size[1]}" aria-hidden="true">${s.art}${text}</svg></div>`,
    iconSize: s.size,
    iconAnchor: s.anchor,
  })
}

/**
 * 国民党军单位图标：燕尾旗（旗杆底端即驻地坐标，旗面写部队简称）
 * @param {string} short 旗面首字（湘/粤/桂/黔/薛/滇/川/张）
 */
export function enemyIcon(short) {
  return L.divIcon({
    className: '',
    html: `<div class="kmt-flag"><svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <line class="ev-pole" x1="9" y1="41" x2="9" y2="4"/>
      <ellipse class="ev-ground" cx="9" cy="41.5" rx="2.4" ry="1"/>
      <circle cx="9" cy="3.5" r="1.5" fill="#9db4c8"/>
      <path d="M10 5 h20 l-5 6.5 5 6.5 h-20 z" fill="rgba(53,72,92,0.78)" stroke="#9db4c8" stroke-width="1.2" stroke-linejoin="round"/>
      <text x="20" y="16.3" text-anchor="middle" font-size="9" font-weight="700" fill="#eef3f8" font-family="Songti SC, STSong, serif">${short}</text>
    </svg></div>`,
    iconSize: [34, 44],
    iconAnchor: [9, 42],
  })
}

/** 日军威胁图标：放射芒星（警示 + 旭日意象；外层 .rays 光束缓脉冲） */
export function japanIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="jp-mark"><svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <path class="rays" d="M54 28 L41.86 33.74 L46.38 46.38 L33.74 41.86 L28 54 L22.26 41.86 L9.62 46.38 L14.14 33.74 L2 28 L14.14 22.26 L9.62 9.62 L22.26 14.14 L28 2 L33.74 14.14 L46.38 9.62 L41.86 22.26 Z"/>
      <path class="core" d="M44 28 L36.31 31.45 L39.31 39.31 L31.45 36.31 L28 44 L24.55 36.31 L16.69 39.31 L19.69 31.45 L12 28 L19.69 24.55 L16.69 16.69 L24.55 19.69 L28 12 L31.45 19.69 L39.31 16.69 L36.31 24.55 Z"/>
      <text x="28" y="31.8" text-anchor="middle" font-size="11" font-weight="700" fill="#ffe0da" stroke="rgba(43,28,16,0.55)" stroke-width="0.7" paint-order="stroke" font-family="Songti SC, STSong, serif">日</text>
    </svg></div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  })
}

/** 精神印记书签图标：静态金色书签（动画只留给当前讲解事件） */
export function storyIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="story-mark">❦</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}
