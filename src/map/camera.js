/**
 * @file 跟随镜头状态机（地图域核心模块）
 *
 * 职责：事件特写 ↔ 跟拍视角之间的所有镜头移动，统一经 begin() 的飞行通道；
 * 行进跟拍用指数平滑（EMA）收敛 + CSS 过渡补间，消除离散 panTo 抖动。
 * 数据来源：ctx.playback（follow/playing/currentEvent/speed/lastEventArmy）、
 *          ctx.armyState / ctx.armyVisible（跟随目标筛选）、ctx.getArmyLayer（取标记）。
 * 写路径：map.panTo / map.flyTo / map.setView / 容器 smooth-follow 类切换。
 *
 * 状态说明：
 * - busy：飞行互斥——飞行期间挂起跟拍，moveend 或超时兜底后释放
 * - anchor：跟拍平滑锚点（镜头中心 EMA）；丢失时从当前视野中心起步平滑收拢
 * - targetKey：当前跟随部队；换部队且相距较远时先飞往再接管
 */
import { FOLLOW_ZOOMS } from '../core/constants/map'

/** 跟随缩放档位：倍速越高视野越广 */
const followZoomFor = (speed) => FOLLOW_ZOOMS[speed] || FOLLOW_ZOOMS[1]

/**
 * 创建镜头控制器（每个地图实例一份）
 * @param {object} ctx
 * @param {() => L.Map|null} ctx.getMap 地图实例取值器（卸载后返回 null）
 * @param {() => HTMLElement|null} ctx.container 地图容器（smooth-follow 类挂在其上）
 * @param {object} ctx.playback 播放引擎单例
 * @param {object} ctx.armyState 各军实时状态（started）
 * @param {object} ctx.armyVisible 各军显隐
 * @param {(key: string) => object|undefined} ctx.getArmyLayer 取某军图层组（含 marker）
 * @param {string[]} ctx.orderedArmyKeys 军的枚举顺序（回退挑选用）
 */
export function createCamera(ctx) {
  let busy = false
  let timer = null
  let endFn = null
  let anchor = null
  let targetKey = null

  /**
   * 挑选跟随目标部队：最近跨过事件所属军优先；
   * 目标必须已出发且未被图例隐藏（否则会跟拍一支隐形部队）
   * @returns {string|null} 军 key；无可跟随目标返回 null
   */
  function followTargetKey() {
    let key = ctx.playback.lastEventArmy
    if (!ctx.getArmyLayer(key) || !ctx.armyState[key]?.started || !ctx.armyVisible[key]) {
      key = ctx.orderedArmyKeys.find((k) => ctx.armyState[k].started && ctx.armyVisible[k])
    }
    return key && ctx.getArmyLayer(key)?.group.hasLayer(ctx.getArmyLayer(key).marker) ? key : null
  }

  /**
   * 结束飞行状态（清定时器/解监听）
   * @param {boolean} resetAnchor 是否同时丢弃跟拍锚点（正常结束丢弃重起步；被打断时保留）
   */
  function end(resetAnchor = true) {
    busy = false
    clearTimeout(timer)
    const map = ctx.getMap()
    if (endFn && map) {
      map.off('moveend', endFn)
      endFn = null
    }
    if (resetAnchor) anchor = null
  }

  /**
   * 统一飞行入口：flyTo 平滑拉推；飞行期间挂起跟拍；
   * moveend 正常释放 + (dur+0.8)s 超时兜底（遮挡环境 rAF/动画冻结时保证落位）
   * @param {[number, number]} target [lat, lng]
   * @param {number} zoom 目标缩放
   * @param {number} [dur=1.5] 飞行时长（秒）
   */
  function begin(target, zoom, dur = 1.5) {
    const map = ctx.getMap()
    if (!map) return
    end(false)
    busy = true
    ctx.container()?.classList.remove('smooth-follow')
    map.flyTo(target, zoom, { duration: dur })
    endFn = () => end(true)
    map.on('moveend', endFn)
    timer = setTimeout(() => {
      if (!busy || !ctx.getMap()) return
      end(false)
      ctx.getMap().setView(target, zoom, { animate: false })
      anchor = null
    }, (dur + 0.8) * 1000)
  }

  /**
   * 恢复跟拍视角：镜头离部队较远或缩放档位不合适时，先平滑飞回（如特写 zoom8 → 跟拍 zoom6）
   * 供"恢复播放/开启跟随/切换倍速"三个时机调用
   */
  function resume() {
    const map = ctx.getMap()
    const { playback } = ctx
    if (!map || !playback.follow || !playback.playing || playback.currentEvent) return
    const key = followTargetKey()
    if (!key) return
    const head = ctx.getArmyLayer(key).marker.getLatLng()
    const c = map.getCenter()
    const z = followZoomFor(playback.speed)
    const far =
      Math.abs(c.lat - head.lat) > 1.2 ||
      Math.abs(c.lng - head.lng) > 1.2 ||
      Math.abs(map.getZoom() - z) > 1
    if (far) begin([head.lat, head.lng], z, 1.5)
    else {
      end(false)
      anchor = null
    }
  }

  /**
   * 跟拍帧（render() 每 tick 调用）：
   * busy 时挂起；换目标且相距远则先飞行接管；否则 EMA 收敛 + smooth-follow 补间
   */
  function tickFollow() {
    const map = ctx.getMap()
    const { playback } = ctx
    if (playback.follow && playback.playing && !playback.currentEvent && !busy) {
      const key = followTargetKey()
      if (!key) {
        ctx.container()?.classList.remove('smooth-follow')
        return
      }
      const head = ctx.getArmyLayer(key).marker.getLatLng()
      if (targetKey !== key) {
        // 跟随目标换部队：相距较远或倍率不合适时，先丝滑飞往新部队再接管跟拍
        targetKey = key
        anchor = null
        const c = map.getCenter()
        if (
          Math.abs(c.lat - head.lat) > 1.8 ||
          Math.abs(c.lng - head.lng) > 1.8 ||
          Math.abs(map.getZoom() - followZoomFor(ctx.playback.speed)) > 1
        ) {
          begin([head.lat, head.lng], followZoomFor(ctx.playback.speed), 1.6)
        }
        return
      }
      // 指数平滑：镜头中心向部队位置收敛（时间常数约 0.6s）；
      // 落后超约 0.6°（高速行军）加大收敛系数追赶。锚点丢失时从当前视野中心起步。
      if (!anchor) {
        const c = map.getCenter()
        anchor = { lat: c.lat, lng: c.lng }
      }
      const dist = Math.hypot(head.lat - anchor.lat, head.lng - anchor.lng)
      const k = dist > 0.6 ? 0.22 : 0.085
      anchor.lat += (head.lat - anchor.lat) * k
      anchor.lng += (head.lng - anchor.lng) * k
      ctx.container()?.classList.add('smooth-follow')
      map.panTo([anchor.lat, anchor.lng], { animate: false })
    } else {
      ctx.container()?.classList.remove('smooth-follow')
    }
  }

  /** 用户拖图夺取镜头：中止飞行（保留锚点由 zoomstart/dragstart 语义决定） */
  function abort() {
    end(false)
  }

  /** 丢弃跟拍锚点（用户缩放后从当前视野重新收拢） */
  function dropAnchor() {
    anchor = null
  }

  /** 组件卸载：清定时器与监听 */
  function destroy() {
    end(false)
    targetKey = null
  }

  return {
    begin,
    end,
    resume,
    tickFollow,
    abort,
    dropAnchor,
    destroy,
    isBusy: () => busy,
  }
}
