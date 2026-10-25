/**
 * @file 已走折线增量维护（播放热路径的核心性能模块）
 *
 * 问题背景：positionAt 每 tick 全量重建 traveled 数组（红一约 790 点），
 * ×3 条折线 ×4 军的 setLatLngs 在 Leaflet 内触发全量重投影 + 简化计算，
 * 峰值约 10 万对象/秒的 GC 压力。
 *
 * 方案：每个军持有持久数组，只追加/改队尾——
 * - 跨过加密点：旧队尾修正为真实途经点，补齐新段，以当前位置收尾
 * - 同段推进：队尾偏移超过 TRAVEL_TAIL_EPS（≈1km）才刷新（限流 setLatLngs）
 * - 完成：缓存最终满数组短路；未出发/回拨：清空或按需重建
 *
 * 写路径：三条折线（casing 衬底 / traveled 主线 / flow 流动虚线）的 setLatLngs。
 */
import { TRAVEL_TAIL_EPS } from '../core/constants/map'

/**
 * 为一支军建立折线跟踪器
 * @param {object} lines 三条同步更新的 Leaflet 折线 { casing, traveled, flow }
 * @returns {{ update: Function, clear: Function, readonly arr: Array, readonly idx: number }}
 */
export function createTravelTracker(lines) {
  /** 持久已走数组（[lat,lng] 前缀 + 当前位置队尾）；null = 尚未出发 */
  let arr = null
  /** 已跨过的加密点索引（与 route.pts 对齐） */
  let idx = 0
  /** 完成态短路标记：到达后不再进入逐帧分支 */
  let done = false

  function setLines(a) {
    lines.casing.setLatLngs(a)
    lines.traveled.setLatLngs(a)
    lines.flow.setLatLngs(a)
  }

  /**
   * 按时刻位置增量维护三条折线
   * @param {object} route preparedRoutes 成员（pts 加密点）
   * @param {object} pos positionAt 结果（started/done/idx/head，noTravel 模式）
   */
  function update(route, pos) {
    const pts = route.pts
    if (!pos.started) {
      if (arr !== null) {
        arr = null
        idx = 0
        done = false
        setLines([])
      }
      return
    }
    if (pos.done) {
      if (!done) {
        arr = pts.map((p) => [p.lat, p.lng])
        idx = pts.length
        done = true
        setLines(arr)
      }
      return
    }
    done = false
    const k = idx
    if (!arr || pos.idx < k) {
      // 首次行军或时间回拨：从起点重建到当前段
      const rebuilt = [[pts[0].lat, pts[0].lng]]
      for (let i = 1; i < pos.idx; i++) rebuilt.push([pts[i].lat, pts[i].lng])
      rebuilt.push([pos.head[0], pos.head[1]])
      arr = rebuilt
      idx = pos.idx
      setLines(arr)
      return
    }
    if (pos.idx > k) {
      // 跨过加密点：旧队尾修正为真实途经点，补齐新段并以当前位置收尾
      arr[arr.length - 1] = [pts[k].lat, pts[k].lng]
      for (let i = k + 1; i < pos.idx; i++) arr.push([pts[i].lat, pts[i].lng])
      arr.push([pos.head[0], pos.head[1]])
      idx = pos.idx
      setLines(arr)
      return
    }
    // 同段推进：队尾偏移超过阈值才刷新（限流 setLatLngs 频率）
    const tail = arr[arr.length - 1]
    if (Math.abs(tail[0] - pos.head[0]) + Math.abs(tail[1] - pos.head[1]) > TRAVEL_TAIL_EPS) {
      tail[0] = pos.head[0]
      tail[1] = pos.head[1]
      setLines(arr)
    }
  }

  /** 彻底清空（组件卸载/重置用） */
  function clear() {
    arr = null
    idx = 0
    done = false
  }

  return {
    update,
    clear,
    get arr() {
      return arr
    },
    get idx() {
      return idx
    },
  }
}
