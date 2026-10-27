/**
 * @file 跨模块 UI 约定常量（兜底时长等）
 *
 * 只登记**应用代码里有引用方**的兜底时长；纯视觉时长（CSS transition/animation）
 * 写在 styles/ 各分片，不在此重复。地图窄屏断点属地图几何（视口预留档位判据），
 * 定义在 core/constants/map.js 的 MAP_VIEW.NARROW_BREAKPOINT，本文件不重复声明。
 *
 * 遮挡环境（失焦、rAF 被系统冻结）下动画不回调，故这些路径必须有非 rAF 兜底：
 * 兜底值取"动画时长 + 余量"，宁可略晚落位也不可永不落位。
 */

/**
 * 兜底超时（ms）：键名 = 机制名 + 用途，取值与引用方一一对应。
 */
export const FALLBACKS = {
  /**
   * 镜头飞行兜底余量（ms）：在 flyTo 时长之上多加的缓冲，
   * 用于 moveend 不触发时强制 setView 落位（见 map/camera.js 的 begin）
   */
  CAMERA_FLY_MS: 800,
  /**
   * 轻提示驻留时长（ms）：flashToast 的 toast 文本展示后自动清空
   * （见 composables/usePlayback.js 的 flashToast）
   */
  TOAST_MS: 4200,
}
