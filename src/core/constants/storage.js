/**
 * @file 本地存储键名（单源）
 * 换键结构即版本升级（旧键自然废弃，读不到回默认值）
 */
export const STORAGE = {
  /** 用户偏好整包（localStorage）：结构不兼容时递增 -vN 后缀 */
  PREFS: 'cz-prefs-v1',
}
