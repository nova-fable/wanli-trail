/**
 * @file 展示格式化：把史实数据行渲染成界面文案的纯函数
 *
 * 职责边界（判定规则见 `./README.md`）：
 * - 只做「数据 → 字符串/展示对象」的转换，不持有史实口径、不 import 数据仓库（`mock/`）。
 * - 需要数据的查询写成**接收数组的首参纯函数**（如 `armyColor(armies, key)`），
 *   `utils/` 不得反向依赖 `mock/`。
 * - 史实领域的换算（兵力约数口径、人物首次登场事件）留在 `mock/`：
 *   `strengthText`（`mock/strength.js`）、`figureColor`（`mock/figures.js`）。
 */

/**
 * 部队主色查询：把组件里散落的 `ARMIES.find((x) => x.key === k)?.color` 收敛到一处
 *
 * @param {Array<{key: string, color: string}>} armies 部队清单（`ARMIES`）
 * @param {string} key 部队 key（`'first'|'second'|'fourth'|'n25'`；`'all'` 等多路主力不是成员）
 * @returns {string|null} 主色；未收录返回 null，由调用方决定兜底色
 */
export function armyColor(armies, key) {
  if (!Array.isArray(armies)) return null
  for (let i = 0; i < armies.length; i++) {
    if (armies[i].key === key) return armies[i].color
  }
  return null
}

/**
 * 部队展示名查询；未收录返回 null
 *
 * @param {Array<{key: string, name: string}>} armies 部队清单（`ARMIES`）
 * @param {string} key 部队 key
 * @returns {string|null}
 */
export function armyName(armies, key) {
  if (!Array.isArray(armies)) return null
  for (let i = 0; i < armies.length; i++) {
    if (armies[i].key === key) return armies[i].name
  }
  return null
}
