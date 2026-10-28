/**
 * @file 地图图层显隐开关（单例）
 *
 * 职责：`armyVisible` / `situationVisible` —— 图例、地图、偏好持久化三方共用的
 * 图层显隐开关。扁平 reactive，直写即可被 SandboxMap 的 deep watch 消费。
 *
 * 刻意不放在这里的东西（各自独立单例，避免"开关"与"数据/热状态"混居）：
 * - 行军路线预处理 → `useRoutes.js`（地图几何，开场页也要用）
 * - 各军行军进度 → `useArmyStatus.js`（每 50ms 被仿真写入的热状态）
 * - 任何 Leaflet 对象（本文件不 import leaflet，保持无 DOM 依赖）
 */
import { reactive } from 'vue'
import { ARMIES } from '../mock'

/** 各路军路线显隐：armyKey → boolean */
export const armyVisible = reactive(
  Object.fromEntries(ARMIES.map((a) => [a.key, true])),
)

/** 战场态势层显隐：根据地 / 国民党军 / 日军威胁 / 精神印记 / 江河要津 */
export const situationVisible = reactive({ zones: true, kmt: true, japan: true, stories: true, rivers: true })

/** 切换某军显隐（图例点击入口；直写 armyVisible 亦可，此函数供模板简写） */
export function toggleArmy(key) {
  armyVisible[key] = !armyVisible[key]
}
