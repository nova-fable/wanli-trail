/**
 * @file 各军行军实时状态（单例，冷热双层）
 *
 * 问题背景：播放引擎每 50ms 调一次 `SandboxMap.render()`，其中无条件写各军进度
 * （started/done/pct）供图例显示。把这份**逐帧被写**的状态做成 reactive 有两个代价：
 *
 * 1. **写入侧开销**：Vue 的 reactive 代理在每次 set 都要走拦截器与依赖通知检查。
 *    实测 20 万帧 × 4 军 × 3 字段：reactive 739.9ms vs markRaw 2.0ms（约 370×）。
 *    播放是常驻行为，这笔开销按帧累积在唯一的热路径上。
 * 2. **读者侧耦合**：任何在渲染期读它的组件都会成为它的订阅者。Vue 对**同值赋值**
 *    有短路（实测写 1000 次相同值触发 0 次 effect），所以重渲染频率实际由 pct
 *    的真实变化率决定——按真实路线数据测得 1× 速率下约 **2 次/秒**，而非 20 次/秒。
 *    但订阅关系本身让"图例"与"50ms 仿真"产生了不必要的耦合：
 *    将来若给热层加字段（如速度、剩余里程），会无声地把图例拖成逐帧重渲染。
 *
 * 方案：冷热分层。
 * - **热层** `armyStatus`（markRaw，非响应式）：由 render() 每帧直写，零依赖追踪开销，
 *   供地图内部（camera 跟随目标筛选）同步读取。
 * - **冷层** `armyDisplay`（reactive）：由 `publishArmyDisplay()` 按**可见变化**推送——
 *   只有 started/done 翻转或 pct 整数变化时才写，使图例的重渲染与"百分比真的变了"
 *   严格对齐，而不是与仿真步长绑定。
 *
 * 为什么 pct 取整后再比较：pct 是 Math.round 后的整数百分比，播放中它只在跨越
 * 1% 边界时变；用取整值比较可天然去抖，且与图例文案「行军中 N%」完全一致。
 */
import { markRaw, reactive } from 'vue'
import { ARMIES } from '../mock'

/** 热层：每帧由 render() 直写（非响应式，避免逐帧触发依赖） */
export const armyStatus = markRaw(
  Object.fromEntries(ARMIES.map((a) => [a.key, { started: false, done: false, pct: 0 }])),
)

/** 冷层：UI 订阅此对象（只在可见变化时被更新） */
export const armyDisplay = reactive(
  Object.fromEntries(ARMIES.map((a) => [a.key, { started: false, done: false, pct: 0 }])),
)

/**
 * 热 → 冷推送（render() 每帧调用，内部自带变更检测，无变化时零写入）
 * 只比较渲染真正用到的三个字段，不做深比较。
 */
export function publishArmyDisplay() {
  for (const a of ARMIES) {
    const hot = armyStatus[a.key]
    const cold = armyDisplay[a.key]
    if (cold.started !== hot.started) cold.started = hot.started
    if (cold.done !== hot.done) cold.done = hot.done
    if (cold.pct !== hot.pct) cold.pct = hot.pct
  }
}
