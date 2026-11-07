/**
 * @file 地名锦旗层：一块共享 WebGL 画布渲染全部途经地名旗（three.js r160）。
 *
 * 每面锦旗 = 一根插在航点上的旗杆 + 一块小型 Verlet 布料：旗面左边缘系在
 * 杆顶，随风向右展开（布料在屏幕坐标系内求解，正交相机按容器像素取景，
 * y 轴向下），地名印进朱红织纹纹理，燕尾绲边与旗杆共用屏幕像素比例。
 * 布料求解移植自 threeui 注册源 lumina-weavers-cloth.html 的 Verlet 布料求解
 * （solve / commit 与曾用于设置面板的 WovenCloth 同源），常数按像素尺度
 * 重新标定：尺寸由 PLACE_BANNER 管理，长地名横向扩展、不缩小字号；
 * 对角约束保持经纬抗剪，弱重力与受限行波保留轻微起伏，避免字面倾塌。
 *
 * 结构：createWovenBannerLayer({ container, sizeEl, project, zIndex }) 返回
 * { setItems, update, updateProjection, destroy }：
 * - setItems(items)：items = [{ key, armyKey, lng, lat, text, color, dateMs }]，全量替换；
 * - update(timeMs, visibleMap)：地图侧每次节流刷新调用，只更新显隐状态；
 *   渲染由内部 rAF 自驱，定时器兜底被遮挡时的投影刷新；
 * - 离屏与重叠锦旗跳过求解，密集地点优先显示最近途经的旗帜；
 * - prefers-reduced-motion 下无动画，静帧预热，投影由地图侧更新。
 */

import * as THREE from 'three'
import { BANNER_CLOTH, PLACE_BANNER } from '../core/constants/banners.js'
import { BANNER_COLORS, GOLD_COLOR } from '../core/constants/colors.js'
import { createBannerCloth, resetBannerCloth, stepBannerCloth } from './bannerCloth.js'
import { bannerWidth, layoutBanners } from './bannerLayout.js'

/** 旗面几何：GX 沿展开方向（流向）、GY 沿旗杆（高度方向） */
const GRID_X = PLACE_BANNER.gridX
const GRID_Y = PLACE_BANNER.gridY
const BANNER_H = PLACE_BANNER.height
const POLE_H = PLACE_BANNER.poleHeight
const DT = BANNER_CLOTH.timeStep

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 织纹纹理：朱红燕尾织面 + 哑金绲边 + 经纬织线 + 军色系带 + 米白宋体地名 */
function makeBannerTexture(text, color, width) {
  const scale = 4
  const W = width
  const H = BANNER_H
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  const outline = new Path2D()
  outline.rect(0.75, 1, W - 1.5, H - 2)
  ctx.save()
  ctx.clip(outline)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, BANNER_COLORS.top)
  g.addColorStop(0.5, BANNER_COLORS.middle)
  g.addColorStop(1, BANNER_COLORS.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 0.35
  ctx.strokeStyle = BANNER_COLORS.ink
  ctx.globalAlpha = 0.12
  for (let y = 0; y < H; y += 1.5) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.strokeStyle = BANNER_COLORS.hem
  ctx.globalAlpha = 0.06
  for (let x = 0; x < W; x += 1.5) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.fillRect(1, 1, 3, H - 2)
  ctx.restore()
  ctx.strokeStyle = BANNER_COLORS.hem
  ctx.lineWidth = 0.8
  ctx.stroke(outline)
  ctx.strokeStyle = GOLD_COLOR
  ctx.lineWidth = 0.5
  ctx.setLineDash([1.5, 1.5])
  ctx.beginPath()
  ctx.moveTo(6, 3.5)
  ctx.lineTo(W - 6, 3.5)
  ctx.moveTo(6, H - 3.5)
  ctx.lineTo(W - 6, H - 3.5)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = BANNER_COLORS.hem
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5
    const radius = i % 2 ? 1.5 : 3.5
    const x = 13 + Math.cos(angle) * radius
    const y = H / 2 + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.fillStyle = BANNER_COLORS.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${PLACE_BANNER.textSize}px "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif`
  const available = W - PLACE_BANNER.textInset - PLACE_BANNER.tailWidth - 3
  let label = text
  if (ctx.measureText(label).width > available) {
    while (label.length && ctx.measureText(label + '…').width > available) label = label.slice(0, -1)
    label += '…'
  }
  ctx.shadowColor = BANNER_COLORS.ink
  ctx.shadowBlur = 1.5
  ctx.shadowOffsetY = 0.5
  ctx.fillText(label, PLACE_BANNER.textInset, H / 2 + 0.6)
  ctx.restore()
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 创建地名锦旗层
 * @param {object} opts
 * @param {HTMLElement} opts.container 画布挂载元素（画布绝对定位铺满其上）
 * @param {HTMLElement} [opts.sizeEl] 尺寸参考元素（默认 container；maplibre 的
 *   canvas-container 高度为 0，须传真实的外层地图容器）
 * @param {Function} opts.project (lng, lat) => { x, y } 容器像素投影
 * @param {number} [opts.zIndex] 画布 z-index
 */
export function createWovenBannerLayer({ container, sizeEl, project, zIndex = 660 }) {
  const sizeOf = () => {
    const el = sizeEl || container
    return { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }
  }
  let { w: width, h: height } = sizeOf()
  let disposed = false

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  } catch {
    // WebGL 不可用（上下文上限/被禁用）：锦旗层是装饰性元素，
    // 静默降级为空实现，绝不拖垮地图本体
    return { setItems() {}, update() {}, updateProjection() {}, destroy() {} }
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.position = 'absolute'
  canvas.style.left = '0'
  canvas.style.top = '0'
  // 显式像素尺寸：挂载元素的 100% 在零高度容器（如 maplibre canvas-container）里会归零
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = String(zIndex)
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  // 正交相机以容器像素取景：left=0/right=w/top=0/bottom=h 使 y 轴向下，与屏幕坐标一致
  const camera = new THREE.OrthographicCamera(0, width, 0, height, -200, 200)
  camera.updateProjectionMatrix()

  // 双侧柔光照亮三维褶皱，环境补光避免小字号随旗面翻转陷入背光
  scene.add(new THREE.AmbientLight(0xffe9d0, 2.2))
  const key = new THREE.DirectionalLight(0xfff0dc, 2.1)
  key.position.set(0.4, -0.7, 1)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xfff5e9, 1.5)
  fill.position.set(-0.6, 0.3, -1)
  scene.add(fill)

  /** 旗杆与杆头（全军共用几何/材质，实例各自定位） */
  const poleGeo = new THREE.CylinderGeometry(0.75, 1, POLE_H, 8)
  const poleMat = new THREE.MeshPhongMaterial({ color: BANNER_COLORS.pole, shininess: 18, depthTest: false })
  const knobGeo = new THREE.SphereGeometry(1.8, 12, 8)
  const knobMat = new THREE.MeshBasicMaterial({ color: GOLD_COLOR, depthTest: false })
  const anchorGeo = new THREE.RingGeometry(1.5, 3, 20)

  const banners = []
  let simT = 0
  let latestTimeMs = -Infinity
  let latestVisible = {}
  let raf = 0
  let fallbackTimer = 0
  let lastFrameAt = 0
  let accumulator = 0
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

  function makeBanner(item) {
    const bannerW = bannerWidth(item.text)
    const phase = (Array.from(item.key).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 628) / 100
    const cloth = createBannerCloth(bannerW, phase)
    const geometry = new THREE.PlaneGeometry(bannerW, BANNER_H, GRID_X, GRID_Y)
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)
    geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage)
    geometry.attributes.position.array.set(cloth.cur)
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({
      map: makeBannerTexture(item.text, item.color, bannerW),
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0,
      emissive: BANNER_COLORS.bottom,
      emissiveIntensity: 0.12,
      transparent: true,
      alphaTest: 0.05,
    })
    const mesh = new THREE.Mesh(geometry, material)
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: material.map, color: BANNER_COLORS.shadow, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    })
    const shadow = new THREE.Mesh(geometry, shadowMaterial)
    const pole = new THREE.Mesh(poleGeo, poleMat)
    const knob = new THREE.Mesh(knobGeo, knobMat)
    const anchorMaterial = new THREE.MeshBasicMaterial({
      color: item.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false,
    })
    const anchor = new THREE.Mesh(anchorGeo, anchorMaterial)
    anchor.scale.y = 0.5
    const group = new THREE.Group()
    group.add(shadow, anchor, pole, knob, mesh)
    group.visible = false
    shadow.renderOrder = 1
    pole.renderOrder = anchor.renderOrder = 2
    mesh.renderOrder = 3
    knob.renderOrder = 4
    mesh.frustumCulled = false
    pole.frustumCulled = false
    shadow.frustumCulled = false
    scene.add(group)
    pole.position.set(0, -POLE_H / 2, 0)
    knob.position.set(0, -POLE_H - 1.5, 0)
    mesh.position.set(1, -POLE_H + 3, 0)
    shadow.position.set(2.5, -POLE_H + 5, 0)
    mesh.rotation.set(-0.4, 0.25, 0)
    shadow.rotation.copy(mesh.rotation)
    return {
      ...item,
      ...cloth,
      width: bannerW,
      visible: false,
      group,
      geometry,
      material,
      shadowMaterial,
      anchorMaterial,
      falling: true,
    }
  }

  function commit(b) {
    const pos = b.geometry.attributes.position
    pos.array.set(b.cur)
    pos.needsUpdate = true
    b.geometry.computeVertexNormals()
  }

  /** 摆放旗杆（杆底插在航点上）与旗面（系杆侧贴杆顶） */
  function place(b) {
    b.group.visible = b.visible
    if (b.visible) b.group.position.set(b.screenX, b.screenY, 0)
  }

  function renderFrame() {
    if (disposed || document.hidden) return
    const now = performance.now()
    accumulator += Math.min(0.05, (now - lastFrameAt) / 1000)
    lastFrameAt = now
    const steps = Math.min(3, Math.floor(accumulator / DT))
    accumulator -= steps * DT
    layoutBanners(banners, latestTimeMs, latestVisible, width, height, project)
    for (const b of banners) {
      place(b)
      if (!b.visible) continue
      if (b.falling) {
        resetBannerCloth(b)
        b.falling = false
      }
    }
    for (let i = 0; i < steps; i++) {
      simT += DT
      for (const b of banners) if (b.visible) stepBannerCloth(b, simT)
    }
    for (const b of banners) if (b.visible) commit(b)
    renderer.render(scene, camera)
  }

  function frame() {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    renderFrame()
  }

  function start() {
    if (disposed || raf || reduceMotion()) return
    raf = requestAnimationFrame(frame)
    lastFrameAt = performance.now()
    fallbackTimer = window.setInterval(() => {
      if (performance.now() - lastFrameAt > 100) renderFrame()
    }, 50)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    clearInterval(fallbackTimer)
    fallbackTimer = 0
    accumulator = 0
  }

  function onVisibility() {
    if (document.hidden) stop()
    else start()
  }

  function onMotionChange() {
    stop()
    if (reduceMotion()) renderOnce()
    else start()
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const s = sizeOf()
    width = s.w
    height = s.h
    renderer.setSize(width, height, false)
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    camera.right = width
    camera.bottom = height
    camera.updateProjectionMatrix()
    if (reduceMotion()) renderOnce()
  }) : null
  observer?.observe(sizeEl || container)

  document.addEventListener('visibilitychange', onVisibility)
  motionQuery?.addEventListener('change', onMotionChange)

  /** 静帧模式：一口气推进到稳态后渲染一次（旗面飘展开成形） */
  function renderOnce() {
    layoutBanners(banners, latestTimeMs, latestVisible, width, height, project)
    for (const b of banners) {
      place(b)
      if (!b.visible || !b.falling) continue
      resetBannerCloth(b)
      for (let s = 0; s < 240; s++) stepBannerCloth(b, simT + s * DT)
      b.falling = false
      commit(b)
    }
    renderer.render(scene, camera)
  }

  function disposeBanners() {
    for (const b of banners) {
      scene.remove(b.group)
      b.geometry.dispose()
      b.material.map.dispose()
      b.material.dispose()
      b.shadowMaterial.dispose()
      b.anchorMaterial.dispose()
    }
    banners.length = 0
  }

  return {
    /** 全量替换锦旗数据（含经纬度、文案、军色、浮现日期） */
    setItems(items) {
      if (disposed) return
      disposeBanners()
      for (const item of items) banners.push(makeBanner(item))
      banners.sort((a, b) => b.dateMs - a.dateMs)
    },
    /** 地图侧每次节流刷新调用：写入显隐状态，动画由 rAF 与定时器兜底驱动 */
    update(timeMs, visibleMap) {
      if (disposed) return
      latestTimeMs = timeMs
      latestVisible = visibleMap || {}
      if (reduceMotion()) {
        // 静帧模式：只对初次可见的旗面预热，显隐与投影始终刷新
        renderOnce()
        return
      }
      start()
    },
    updateProjection() {
      if (!disposed && reduceMotion()) renderOnce()
    },
    destroy() {
      disposed = true
      stop()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery?.removeEventListener('change', onMotionChange)
      disposeBanners()
      poleGeo.dispose()
      poleMat.dispose()
      knobGeo.dispose()
      knobMat.dispose()
      anchorGeo.dispose()
      renderer.dispose()
      renderer.forceContextLoss?.()
      canvas.remove()
    },
  }
}
