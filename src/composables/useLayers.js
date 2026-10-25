import { reactive } from 'vue'
import { ARMIES } from '../data/armies'
import { prepareRoute } from '../utils/geo'

// 各路军路线显隐
export const armyVisible = reactive(
  Object.fromEntries(ARMIES.map((a) => [a.key, true])),
)

// 战场态势层显隐：根据地 / 国民党军 / 日军威胁 / 精神印记
export const situationVisible = reactive({ zones: true, kmt: true, japan: true, stories: true })

// 预处理后的路线（带时间戳与累计里程）
export const preparedRoutes = Object.fromEntries(
  ARMIES.map((a) => [a.key, prepareRoute(a.route)]),
)

// 各路军实时状态：{ started, done, pct }，由地图组件每帧写入
export const armyState = reactive(
  Object.fromEntries(ARMIES.map((a) => [a.key, { started: false, done: false, pct: 0 }])),
)

export function toggleArmy(key) {
  armyVisible[key] = !armyVisible[key]
}
