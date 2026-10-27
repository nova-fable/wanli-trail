/**
 * @file 路线方向箭头模块
 *
 * 职责：沿已走路段按里程间距布设 ▲（按路径方位角旋转指向行军方向）。
 * 布设策略：traveled 数组是稠密路线的稳定前缀，前进时增量补箭头；
 * 里程明显回缩（arrowMaxKm 单调记录被超越）或缩放档位变化时整组重建。
 *
 * 写路径：往军图层组内的 arrowLayerGroup 增删 divIcon 标记。
 */
import L from 'leaflet'
import { haversineKm } from '../utils/geo'
import { ARROWS } from '../core/constants/map'

/** 缩放档位 → 箭头里程间距：低倍率大间距，省级视野加密保证可见 */
export const arrowStepFor = (zoom) => (zoom >= ARROWS.DENSE_ZOOM ? ARROWS.STEP.NEAR : ARROWS.STEP.FAR)

/**
 * 在 a→b 段末尾布一枚箭头（屏幕旋转角 = 方位角，自北顺时针）
 * @param {L.LayerGroup} group 箭头容器
 * @param {number[]} a 段起点 [lat,lng]
 * @param {number[]} b 段终点 [lat,lng]
 * @param {string} color 军主色（--ac 变量）
 */
function addArrow(group, a, b, color) {
  const rad = Math.atan2((b[1] - a[1]) * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180), b[0] - a[0])
  const ang = (rad * 180) / Math.PI
  L.marker(b, {
    icon: L.divIcon({
      className: '',
      html: `<span class="route-arrow" style="--ac:${color};transform:rotate(${ang.toFixed(1)}deg)">▲</span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 400,
  }).addTo(group)
}

/**
 * 同步某军的箭头（render 每 tick 调用；状态字段挂在 ly 上：
 * arrows / arrowIdx / arrowAcc / arrowPlaced / arrowMaxKm / arrowStep）
 * @param {object} ly 军图层集合（group + 箭头状态字段）
 * @param {object} tracker createTravelTracker 实例（读 arr 已走数组）
 * @param {object} pos positionAt 结果（km 当前进度里程）
 * @param {string} color 军主色
 * @param {number} step 当前缩放档位的间距（km）
 */
export function syncArrows(ly, tracker, pos, color, step) {
  // arrowMaxKm 只增不减：回拨后仍高于它的箭头属于"未来"，必须重建清除
  if (ly.arrows && pos.km < (ly.arrowMaxKm || 0) - step / 4) {
    ly.group.removeLayer(ly.arrows)
    ly.arrows = null
  }
  // 缩放档位变化（140km ↔ 60km）→ 重建以换密度
  if (ly.arrowStep !== step) {
    ly.arrowStep = step
    if (ly.arrows) {
      ly.group.removeLayer(ly.arrows)
      ly.arrows = null
    }
  }
  if (!ly.arrows) {
    ly.arrows = L.layerGroup().addTo(ly.group)
    ly.arrowIdx = 1
    ly.arrowAcc = 0
    ly.arrowPlaced = -step / 2
    ly.arrowMaxKm = pos.km
  }
  // 沿已走数组增量补箭头（arr 由 traveled 模块增量维护，索引与加密点对齐）
  const ll = tracker.arr || []
  for (let i = Math.max(ly.arrowIdx, 1); i < ll.length; i++) {
    const a = ll[i - 1]
    const b = ll[i]
    ly.arrowAcc += haversineKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] })
    if (ly.arrowAcc - ly.arrowPlaced >= step) {
      ly.arrowPlaced = ly.arrowAcc
      addArrow(ly.arrows, a, b, color)
    }
  }
  ly.arrowIdx = Math.max(ly.arrowIdx, ll.length)
  ly.arrowMaxKm = Math.max(ly.arrowMaxKm || 0, pos.km)
}

/**
 * 清除某军全部箭头（部队未出发/图层重建时）
 * @param {object} ly 军图层集合
 */
export function clearArrows(ly) {
  if (ly.arrows) {
    ly.group.removeLayer(ly.arrows)
    ly.arrows = null
    ly.arrowMaxKm = null
  }
}
