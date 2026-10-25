/**
 * @file 战场态势图层构建与时间窗显隐
 *
 * 职责：五类态势实体的 Leaflet 构建（苏区/封锁线/国民党军/日军/精神印记）+
 * 江河要津静态地理层；按时刻 t 的时间窗显隐（状态翻转才操作 DOM）；
 * 播放跨越精神印记时的 toast 回调。
 * 数据来源：situation.js / rivers.js / stories.js（全部带 from/to 时间窗，endOfDay 语义）。
 * 写路径：各实体在其 layerGroup 内 add/remove；不写盘。
 */
import L from 'leaflet'
import { ZONES, KMT_BLOCKADES, KMT_UNITS, JAPAN_CRISES } from '../data/situation'
import { RIVERS } from '../data/rivers'
import { STORIES } from '../data/stories'
import { parseDate, endOfDay } from '../utils/geo'
import { ZONE_COLOR, BLOCKADE_COLOR, RIVER_COLOR } from '../core/constants/colors'
import { enemyIcon, japanIcon, storyIcon } from './icons'

/**
 * 态势信息弹窗 HTML（苏区/封锁线/单位/日军/故事共用骨架）
 * @param {object} d 数据实体（name/dateLabel/desc）
 * @param {string} side 归属徽标文本（如"红军根据地"/"国民党军"）
 */
function warPopup(d, side) {
  return `<div class="war-pop"><div class="wp-side">${side}</div><h5>${d.name}</h5><div class="wp-date">${d.dateLabel}</div><p>${d.desc}</p></div>`
}

/**
 * 构建全部态势图层（地图初始化时调用一次；先于路线加入，使路线绘制在其上）
 * @param {L.Map} map 地图实例
 * @returns {{ layers: object, update: Function }} layers 键：zones/kmt/japan/stories/rivers；
 *   update(t, { playing, onStory }) 按时刻显隐并触发精神印记回调
 */
export function buildSituationLayers(map) {
  const layers = {
    zones: L.layerGroup().addTo(map),
    kmt: L.layerGroup().addTo(map),
    japan: L.layerGroup().addTo(map),
    stories: L.layerGroup().addTo(map),
    rivers: L.layerGroup().addTo(map),
  }
  /** 时间窗实体登记表：{ id, data, obj, group, active }（active=undefined 表示未初始化） */
  const entities = []
  /** 已越过的精神印记数（播放 toast 用；STORIES 按时间升序） */
  let storyCursor = 0

  // ===== 江河要津：静态地理层（无时间窗），青蓝双色衬底突出 =====
  RIVERS.forEach((r) => {
    const mid = r.pts[Math.floor(r.pts.length / 2)]
    L.polyline(r.pts, {
      color: RIVER_COLOR,
      weight: 5.5,
      opacity: 0.22,
      smoothFactor: 0.5,
      interactive: false,
    }).addTo(layers.rivers)
    const line = L.polyline(r.pts, {
      color: RIVER_COLOR,
      weight: 2,
      opacity: 0.8,
      smoothFactor: 0.5,
      interactive: true,
    })
    line.bindTooltip(`◈ ${r.name}`, { permanent: true, direction: 'center', className: 'river-label' })
    line.bindPopup(
      `<div class="war-pop"><div class="wp-side">江河要津</div><h5>${r.name}</h5><p>长征途中红军跋涉渡过的大江大河（简化示意走线）。湘江血战、乌江天险、四渡赤水、巧渡金沙江、强渡大渡河——一条大河就是一道雄关。</p></div>`,
      { className: 'war-popup', maxWidth: 280 },
    )
    line.addTo(layers.rivers)
  })

  // ===== 红军根据地（半透明圆域 + 常驻标签）：出发即失去、会师即获得 =====
  ZONES.forEach((z) => {
    const c = L.circle([z.lat, z.lng], {
      radius: z.radius * 1000,
      color: ZONE_COLOR,
      weight: 1.5,
      opacity: 0.85,
      dashArray: '4 6',
      fillColor: ZONE_COLOR,
      fillOpacity: 0.08,
    })
    c.bindTooltip(z.name, { permanent: true, direction: 'center', className: 'zone-label' })
    c.bindPopup(warPopup(z, '红军根据地'), { className: 'war-popup', maxWidth: 290 })
    entities.push({ id: z.id, data: z, obj: c, group: 'zones', active: undefined })
  })

  // ===== 封锁线（粗虚线 + 中点常驻标签），to = 被突破日 =====
  KMT_BLOCKADES.forEach((b) => {
    const line = L.polyline(b.latlngs, {
      color: BLOCKADE_COLOR,
      weight: 7,
      opacity: 0.85,
      dashArray: '12 8',
      lineCap: 'butt',
      interactive: true,
    })
    line.bindPopup(warPopup(b, '国民党军·封锁线'), { className: 'war-popup', maxWidth: 290 })
    const mid = b.latlngs[Math.floor(b.latlngs.length / 2)]
    const label = L.tooltip({ permanent: true, direction: 'top', className: 'kmt-label', offset: [0, 8] })
      .setLatLng(mid)
      .setContent(b.name)
    entities.push({
      id: b.id,
      data: b,
      obj: L.layerGroup([line, label]),
      group: 'kmt',
      active: undefined,
    })
  })

  // ===== 国民党军单位（燕尾旗）=====
  KMT_UNITS.forEach((u) => {
    const m = L.marker([u.lat, u.lng], { icon: enemyIcon(u.short), zIndexOffset: 200 })
    m.bindTooltip(`${u.name}（${u.dateLabel}）`, { direction: 'top', offset: [0, -42], className: 'ev-tip' })
    m.bindPopup(warPopup(u, '国民党军'), { className: 'war-popup', maxWidth: 290 })
    entities.push({ id: u.id, data: u, obj: m, group: 'kmt', active: undefined })
  })

  // ===== 日军威胁（放射芒星）=====
  JAPAN_CRISES.forEach((j) => {
    const m = L.marker([j.lat, j.lng], { icon: japanIcon(), zIndexOffset: 150 })
    m.bindTooltip(`${j.name}（${j.dateLabel}）`, { direction: 'top', offset: [0, -32], className: 'ev-tip' })
    m.bindPopup(warPopup(j, '日军威胁'), { className: 'war-popup', maxWidth: 290 })
    entities.push({ id: j.id, data: j, obj: m, group: 'japan', active: undefined })
  })

  // ===== 精神印记（金色书签，点击阅读故事）=====
  STORIES.forEach((s) => {
    const m = L.marker([s.lat, s.lng], { icon: storyIcon(), zIndexOffset: 300 })
    m.bindTooltip(`❦ 精神印记 ·《${s.name}》`, { direction: 'top', offset: [0, -14], className: 'ev-tip' })
    m.bindPopup(warPopup(s, '精神印记'), { className: 'war-popup', maxWidth: 290 })
    entities.push({ id: s.id, data: s, obj: m, group: 'stories', active: undefined })
  })

  /**
   * 按时刻显隐全部时间窗实体（仅在状态翻转时操作 DOM）
   * @param {number} t 当前时刻（ms）
   * @param {{ playing: boolean, onStory: (story: object) => void }} fx 播放态与精神印记回调
   */
  function update(t, { playing, onStory }) {
    for (const e of entities) {
      // 时间窗语义：from ≤ t ≤ endOfDay(to)（to 含当日），与图例计数同源
      const now = parseDate(e.data.from) <= t && t <= endOfDay(e.data.to)
      if (now === e.active) continue
      e.active = now
      const group = layers[e.group]
      if (now) e.obj.addTo(group)
      else group.removeLayer(e.obj)
    }
    // 播放中跨越精神印记 → toast 轻提示（不中断行军；STORIES 按时间升序扫描）
    let crossed = 0
    for (const s of STORIES) {
      if (parseDate(s.from) <= t) crossed++
      else break
    }
    if (crossed > storyCursor && playing) onStory(STORIES[storyCursor])
    storyCursor = crossed
  }

  return { layers, update }
}
