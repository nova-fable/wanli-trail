/**
 * @file 地名锦旗层：一块共享 WebGL 画布渲染全部途经地名旗（three.js r160）。
 *
 * 每面锦旗是一块小型 Verlet 布料——顶边钉在航点的屏幕投影位置，布料在屏幕
 * 坐标系内求解（正交相机按容器像素取景，y 轴向下），地名印进织纹纹理随风飞。
 * 求解器移植自 threeui 注册源 lumina-weavers-cloth.html 的 Verlet 布料求解
 * （wind / step / solve / commit 与曾用于设置面板的 WovenCloth 同源），
 * 常数按像素尺度重新标定：旗面 64×26px、重力 300px/s²、摆动幅度按「下缘
 * 位移 ±8px」标定。
 *
 * 结构：createWovenBannerLayer({ container, project, zIndex }) 返回
 * { setItems, update, destroy }：
 * - setItems(items)：items = [{ key, lng, lat, text, color, dateMs }]，全量替换；
 * - update(timeMs, visibleMap)：地图侧每次节流刷新调用，只更新显隐状态；
 *   渲染由内部 rAF 自驱（地图拖拽/飞行时投影自动跟随，不依赖地图侧帧循环）；
 * - 离屏锦旗跳过求解；dateMs 到达时布料从平板坠落入位（与源码开场一致）；
 * - prefers-reduced-motion 下无 rAF，静帧渲染（布料预热闹到稳态）。
 */

import * as THREE from 'three'

/** 旗面几何：网格密度在 119 面同屏的求解量与布感之间取平衡 */
const GRID_X = 12
const GRID_Y = 6
const BANNER_W = 64
const BANNER_H = 26
const GRAVITY = 300
const DAMPING = 0.985
const DT = 1 / 60
const PIN_OFFSET_Y = 5
const CULL_MARGIN = 100

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 织纹纹理：象牙织面 + 双道绛红绲边 + 经纬织线 + 军色菱形标 + 地名（衬线绛字）+ 竹节噪点 */
function makeBannerTexture(text, color) {
  const W = 288
  const H = 120
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f1e8d6')
  g.addColorStop(0.55, '#e9dfca')
  g.addColorStop(1, '#e0d4bc')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(165, 32, 44, 0.9)'
  ctx.lineWidth = 7
  ctx.strokeRect(8, 8, W - 16, H - 16)
  ctx.strokeStyle = 'rgba(124, 22, 34, 0.8)'
  ctx.lineWidth = 2.5
  ctx.strokeRect(18, 18, W - 36, H - 36)
  ctx.lineWidth = 1
  for (let y = 0; y < H; y += 3) {
    ctx.strokeStyle = 'rgba(60, 30, 20, 0.05)'
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
    ctx.stroke()
  }
  for (let x = 0; x < W; x += 3) {
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.06)'
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(50, H / 2)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = color
  ctx.fillRect(-9, -9, 18, 18)
  ctx.restore()
  ctx.fillStyle = '#6d1620'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let fs = 42
  ctx.font = `700 ${fs}px Georgia, "Times New Roman", "Songti SC", "STSong", "SimSun", serif`
  while (fs > 22 && ctx.measureText(text).width > W - 104) {
    fs -= 2
    ctx.font = `700 ${fs}px Georgia, "Times New Roman", "Songti SC", "STSong", "SimSun", serif`
  }
  ctx.fillText(text, 72, H / 2 + 2)
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 2 - 1) * 9
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 创建地名锦旗层
 * @param {object} opts
 * @param {HTMLElement} opts.container 地图容器（画布绝对定位铺满其上）
 * @param {Function} opts.project (lng, lat) => { x, y } 容器像素投影
 * @param {number} [opts.zIndex] 画布 z-index
 */
export function createWovenBannerLayer({ container, project, zIndex = 660 }) {
  let width = Math.max(1, container.clientWidth)
  let height = Math.max(1, container.clientHeight)
  let disposed = false

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  } catch {
    // WebGL 不可用（上下文上限/被禁用）：锦旗层是装饰性元素，
    // 静默降级为空实现，绝不拖垮地图本体
    return { setItems() {}, update() {}, destroy() {} }
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = String(zIndex)
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  // 正交相机以容器像素取景：left=0/right=w/top=0/bottom=h 使 y 轴向下，与屏幕坐标一致
  const camera = new THREE.OrthographicCamera(0, width, 0, height, -200, 200)
  camera.updateProjectionMatrix()

  scene.add(new THREE.AmbientLight(0xffe9d0, 0.85))
  const key = new THREE.DirectionalLight(0xfff0dc, 0.9)
  key.position.set(0.4, -0.7, 1)
  scene.add(key)

  const banners = []
  const restW = BANNER_W / GRID_X
  const restH = BANNER_H / GRID_Y
  let simT = 0
  let latestTimeMs = -Infinity
  let latestVisible = {}
  let raf = 0
  let settledAll = false
  let settledCount = -1

  const index = (ix, iy) => ix + iy * (GRID_X + 1)

  function makeBanner(item) {
    const nodeCount = (GRID_X + 1) * (GRID_Y + 1)
    const rest = new Float32Array(nodeCount * 3)
    for (let iy = 0; iy <= GRID_Y; iy++) {
      for (let ix = 0; ix <= GRID_X; ix++) {
        const i = index(ix, iy)
        rest[i * 3] = (ix / GRID_X) * BANNER_W - BANNER_W / 2
        rest[i * 3 + 1] = (iy / GRID_Y) * BANNER_H
      }
    }
    const geometry = new THREE.PlaneGeometry(BANNER_W, BANNER_H, GRID_X, GRID_Y)
    const material = new THREE.MeshPhongMaterial({
      map: makeBannerTexture(item.text, item.color),
      side: THREE.DoubleSide,
      shininess: 10,
      specular: 0x2a1410,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.visible = false
    mesh.frustumCulled = false
    scene.add(mesh)
    return {
      ...item,
      mesh,
      geometry,
      material,
      rest,
      cur: new Float32Array(nodeCount * 3),
      prev: new Float32Array(nodeCount * 3),
      pinned: new Uint8Array(nodeCount),
      phase: ((item.key.length * 137) % 628) / 100,
      falling: true,
      added: false,
    }
  }

  function resetSim(b) {
    for (let i = 0; i < b.cur.length; i++) {
      b.cur[i] = b.rest[i]
      b.prev[i] = b.rest[i]
    }
    for (let ix = 0; ix <= GRID_X; ix++) b.pinned[ix] = 1
  }

  function solve(b, a, c, restLength) {
    const cur = b.cur
    let dx = cur[c * 3] - cur[a * 3]
    let dy = cur[c * 3 + 1] - cur[a * 3 + 1]
    let dz = cur[c * 3 + 2] - cur[a * 3 + 2]
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
    const diff = ((d - restLength) / d) * 0.5
    dx *= diff
    dy *= diff
    dz *= diff
    const pa = b.pinned[a]
    const pb = b.pinned[c]
    if (!pa && !pb) {
      cur[a * 3] += dx; cur[a * 3 + 1] += dy; cur[a * 3 + 2] += dz
      cur[c * 3] -= dx; cur[c * 3 + 1] -= dy; cur[c * 3 + 2] -= dz
    } else if (pa && !pb) {
      cur[c * 3] -= dx * 2; cur[c * 3 + 1] -= dy * 2; cur[c * 3 + 2] -= dz * 2
    } else if (!pa && pb) {
      cur[a * 3] += dx * 2; cur[a * 3 + 1] += dy * 2; cur[a * 3 + 2] += dz * 2
    }
  }

  /** 风场：与源码同构（顺风行波 + 阵风包络），常数按像素尺度标定（下缘位移 ±8px） */
  function step(b) {
    const { cur, prev, pinned, rest } = b
    for (let iy = 0; iy <= GRID_Y; iy++) {
      for (let ix = 0; ix <= GRID_X; ix++) {
        const i = index(ix, iy)
        if (pinned[i]) continue
        const cx = ix / GRID_X
        const cy = iy / GRID_Y
        const travel = simT * 3.2 - cy * 2.4 + b.phase
        const gust = 0.55 + 0.45 * Math.sin(simT * 1.1 + b.phase * 2)
        const az = (Math.sin(travel + cx * 3.6) + 0.5 * Math.sin(travel * 1.63 + cx * 6.4)) * (30 + 62 * cy) * gust
        const ax = Math.sin(simT * 1.3 + cy * 2.2 + b.phase) * (12 + 24 * cy) * gust
        const ay = 16 * cy
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k
          const a = k === 0 ? ax : k === 1 ? ay + GRAVITY : az
          const v = (cur[j] - prev[j]) * DAMPING
          prev[j] = cur[j]
          cur[j] = cur[j] + v + a * DT * DT
        }
      }
    }
    for (let it = 0; it < 3; it++) {
      for (let iy = 0; iy <= GRID_Y; iy++) {
        for (let ix = 0; ix < GRID_X; ix++) solve(b, index(ix, iy), index(ix + 1, iy), restW)
      }
      for (let iy = 0; iy < GRID_Y; iy++) {
        for (let ix = 0; ix <= GRID_X; ix++) solve(b, index(ix, iy), index(ix, iy + 1), restH)
      }
    }
    // 顶边钉死在航点（源码同一处理）
    for (let ix = 0; ix <= GRID_X; ix++) {
      const i = index(ix, 0)
      for (let k = 0; k < 3; k++) {
        cur[i * 3 + k] = rest[i * 3 + k]
        prev[i * 3 + k] = rest[i * 3 + k]
      }
    }
  }

  function commit(b) {
    const pos = b.geometry.attributes.position
    for (let i = 0; i < b.cur.length / 3; i++) {
      pos.setXYZ(i, b.cur[i * 3], b.cur[i * 3 + 1], b.cur[i * 3 + 2])
    }
    pos.needsUpdate = true
    b.geometry.computeVertexNormals()
  }

  function frame() {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    if (document.hidden) return
    simT += DT
    for (const b of banners) {
      const on = b.dateMs <= latestTimeMs && latestVisible[b.armyKey] !== false
      if (!on) {
        if (b.mesh.visible) b.mesh.visible = false
        continue
      }
      const p = project(b.lng, b.lat)
      const offscreen =
        p.x < -CULL_MARGIN || p.x > width + CULL_MARGIN ||
        p.y < -CULL_MARGIN || p.y > height + CULL_MARGIN
      if (offscreen) {
        if (b.mesh.visible) b.mesh.visible = false
        continue
      }
      b.mesh.visible = true
      if (b.falling) {
        resetSim(b)
        b.falling = false
      }
      b.mesh.position.set(p.x, p.y + PIN_OFFSET_Y, 0)
      step(b)
      commit(b)
    }
    renderer.render(scene, camera)
  }

  function start() {
    if (disposed || raf || reduceMotion()) return
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function onVisibility() {
    if (document.hidden) stop()
    else start()
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.right = width
    camera.bottom = height
    camera.updateProjectionMatrix()
    if (reduceMotion()) renderOnce()
  }) : null
  observer?.observe(container)

  /** 静帧模式：一口气推进到稳态后渲染一次（布料落定成形） */
  function renderOnce() {
    for (let s = 0; s < 240; s++) {
      simT += DT
      for (const b of banners) {
        if (b.dateMs > latestTimeMs || latestVisible[b.armyKey] === false) continue
        if (b.falling) {
          resetSim(b)
          b.falling = false
        }
        const p = project(b.lng, b.lat)
        b.mesh.position.set(p.x, p.y + PIN_OFFSET_Y, 0)
        step(b)
      }
    }
    for (const b of banners) {
      const p = project(b.lng, b.lat)
      b.mesh.position.set(p.x, p.y + PIN_OFFSET_Y, 0)
      commit(b)
      b.mesh.visible = b.dateMs <= latestTimeMs && latestVisible[b.armyKey] !== false
    }
    renderer.render(scene, camera)
  }

  return {
    /** 全量替换锦旗数据（含经纬度、文案、军色、浮现日期） */
    setItems(items) {
      for (const b of banners) {
        scene.remove(b.mesh)
        b.geometry.dispose()
        b.material.dispose()
        b.material.map.dispose()
      }
      banners.length = 0
      for (const item of items) banners.push(makeBanner(item))
      settledAll = false
    },
    /** 地图侧每次节流刷新调用：只写状态，渲染由 rAF 自驱 */
    update(timeMs, visibleMap) {
      if (disposed) return
      latestTimeMs = timeMs
      latestVisible = visibleMap || {}
      if (reduceMotion()) {
        // 静帧模式：可见锦旗数量变化（新地点被经过/回拨）才重算一次稳态
        const on = banners.filter((b) => b.dateMs <= latestTimeMs && latestVisible[b.armyKey] !== false).length
        if (!settledAll || on !== settledCount) {
          renderOnce()
          settledAll = true
          settledCount = on
        }
        return
      }
      settledAll = false
      start()
    },
    destroy() {
      disposed = true
      stop()
      observer?.disconnect()
      for (const b of banners) {
        scene.remove(b.mesh)
        b.geometry.dispose()
        b.material.dispose()
        b.material.map.dispose()
      }
      banners.length = 0
      renderer.dispose()
      renderer.forceContextLoss?.()
      canvas.remove()
    },
  }
}
