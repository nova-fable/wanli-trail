/**
 * @file 地图配色常量（JS 侧单源）
 *
 * CSS 设计 token（--accent 三级金等）在 styles/global.css :root；
 * 本文件只收 Leaflet 图层里使用的硬编码色，避免散落各构建函数。
 */

/** 江河要津：主线/衬底色（图例色块同源） */
export const RIVER_COLOR = '#2f7fbf'

/** 红军根据地区域：描边与填充 */
export const ZONE_COLOR = '#c62828'

/** 国民党军封锁线 */
export const BLOCKADE_COLOR = '#455a64'
