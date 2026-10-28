/**
 * @file 行军路线预处理（单例）
 *
 * 职责：把 `mock/routes/*` 的带日期航点做一次性预处理——Catmull-Rom 样条加密、
 * 附加时间戳与累计里程——产出 `positionAt` 直接可用的路线对象。
 *
 * 为什么独立于 `useLayers.js`：这份数据是**地图几何**，不是图层开关，且消费者
 * 不只地图——开场页的微缩路线剪影也用它做投影。放进 useLayers 会让一个非地图页面
 * 依赖"图层显隐"模块，语义错位。
 *
 * 刻意不进响应式系统（普通对象，非 reactive）：路线是纯派生常量，永不变化；
 * 进 reactive 会让每帧 `positionAt(route, ...)` 的每次属性读取都走代理，
 * 而这是 50ms 热路径上的主要读点。
 */
import { ARMIES } from '../mock'
import { prepareRoute } from '../utils/geo'

/**
 * 预处理后的路线：armyKey → { pts, cum, totalKm, startT, endT }
 * - `pts` 加密点（含 lat/lng/t），`cum` 累计里程前缀和，`totalKm` 全程公里数
 * - 四路共 ~183 个航点 → 加密后数千点，只在模块求值期算一次
 */
export const preparedRoutes = Object.fromEntries(
  ARMIES.map((a) => [a.key, prepareRoute(a.route)]),
)
