/**
 * @file 地图配色常量（JS 侧单源）
 *
 * CSS 设计 token（--accent 三级金等）在 styles/tokens.css 的 :root；
 * 本文件只收 JS 侧构建函数与图例色块使用的硬编码色，避免散落各处。
 */

/** 江河要津：主线/衬底色（图例色块同源） */
export const RIVER_COLOR = '#2f7fbf'

/** 红军根据地区域：描边与填充 */
export const ZONE_COLOR = '#c62828'

/** 国民党军封锁线 */
export const BLOCKADE_COLOR = '#455a64'

/**
 * 交互金：与 CSS token --accent 同值但分属 JS 侧单源。
 * 用于多路红军主力（army === 'all'）与精神印记等无部队归属的金色图例项。
 */
export const GOLD_COLOR = '#d4a94e'
