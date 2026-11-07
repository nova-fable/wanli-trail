/**
 * @file 地名锦旗层：一块共享 WebGL 画布渲染全部途经地名旗（three.js r160）。
 *
 * 每面锦旗 = 一根插在航点上的旗杆 + 一块小型 Verlet 布料：旗面左边缘系在
 * 杆顶，随风向右展开（布料在屏幕坐标系内求解，正交相机按容器像素取景，
 * y 轴向下），地名印进织纹纹理。
 * 布料求解移植自 threeui 注册源 lumina-weavers-cloth.html 的 Verlet 布料求解
 * （solve / commit 与曾用于设置面板的 WovenCloth 同源），常数按像素尺度
 * 重新标定：旗面 64×24px、重力 80px/s²、稳态风 260px/s²（旗面近乎水平
 * 展开、保留少量垂坠），摆动幅度按「自由端位移 ±5px」标定。
 *
 * 结构：createWovenBannerLayer({ container, sizeEl, project, zIndex }) 返回
 * { setItems, update, destroy }：
 * - setItems(items)：items = [{ key, lng, lat, text, color, dateMs }]，全量替换；
 * - update(timeMs, visibleMap)：地图侧每次节流刷新调用，只更新显隐状态；
 *   渲染由内部 rAF 自驱（地图拖拽/飞行时投影自动跟随，不依赖地图侧帧循环）；
 * - 离屏锦旗跳过求解；dateMs 到达时旗面从系杆状态飘展开（自然入场）；
 * - prefers-reduced-motion 下无 rAF，静帧渲染（布料预热闹到稳态）。
 */

import * as THREE from 'three'

/** 旗面几何：GX 沿展开方向（流向）、GY 沿旗杆（高度方向） */
const GRID_X = 12
const GRID_Y = 5
const BANNER_W = 64
const BANNER_H = 24
const POLE_H = 30
const GRAVITY = 80
const DAMPING = 0.985
const DT = 1 / 60
const CULL_MARGIN = 100

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 织纹纹理：象牙织面 + 双道绛红绲边 + 经纬织线 + 军色菱形标 + 地名（衬线绛字）+ 竹节噪点 */
function makeBannerTexture(text, color) {
  const W = 288
  const H = 108
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f7f0e1')
  g.addColorStop(0.55, '#efe5d0')
  g.addColorStop(1, '#e8dcc4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(165, 32, 44, 0.85)'
  ctx.lineWidth = 5
  ctx.strokeRect(8, 8, W - 16, H - 16)
  ctx.strokeStyle = 'rgba(124, 22, 34, 0.7)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(16, 16, W - 32, H - 32)
  ctx.lineWidth = 1
  for (let y = 0; y < H; y += 3) {
    ctx.strokeStyle = 'rgba(60, 30, 20, 0.045)'
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
    ctx.stroke()
  }
  for (let x = 0; x < W; x += 3) {
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.055)'
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(48, H / 2)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = color
  ctx.fillRect(-8.5, -8.5, 17, 17)
  ctx.restore()
  ctx.fillStyle = '#7c1a26'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  let fs = 40
  ctx.font = `700 ${fs}px Georgia, "Times New Roman", "Songti SC", "STSong", "SimSun", serif`
  while (fs > 22 && ctx.measureText(text).width > W - 96) {
    fs -= 2
    ctx.font = `700 ${fs}px Georgia, "Times New Roman", "Songti SC", "STSong", "SimSun", serif`
  }
  ctx.fillText(text, 68, H / 2 + 2)
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 2 - 1) * 8
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
    return { setItems() {}, update() {}, destroy() {} }
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

  // 光照以环境光为主：64px 的小旗面稍有倾斜就整体背光发暗，方向光只保留少量
  // 明暗起伏供褶皱读感
  scene.add(new THREE.AmbientLight(0xffe9d0, 1.05))
  const key = new THREE.DirectionalLight(0xfff0dc, 0.55)
  key.position.set(0.4, -0.7, 1)
  scene.add(key)

  /** 旗杆与杆头（全军共用几何/材质，实例各自定位） */
  const poleGeo = new THREE.PlaneGeometry(2, POLE_H + 2)
  const poleMat = new THREE.MeshBasicMaterial({ color: 0x5d4030 })
  const knobGeo = new THREE.CircleGeometry(2.4, 12)
  const knobMat = new THREE.MeshBasicMaterial({ color: 0xa5202c })

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
        rest[i * 3] = (ix / GRID_X) * BANNER_W
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
    const pole = new THREE.Mesh(poleGeo, poleMat)
    const knob = new THREE.Mesh(knobGeo, knobMat)
    mesh.visible = false
    pole.visible = false
    knob.visible = false
    mesh.frustumCulled = false
    pole.frustumCulled = false
    scene.add(pole)
    scene.add(knob)
    scene.add(mesh)
    return {
      ...item,
      mesh,
      pole,
      knob,
      geometry,
      material,
      rest,
      cur: new Float32Array(nodeCount * 3),
      prev: new Float32Array(nodeCount * 3),
      pinned: new Uint8Array(nodeCount),
      phase: ((item.key.length * 137) % 628) / 100,
      falling: true,
    }
  }

  function resetSim(b) {
    for (let i = 0; i < b.cur.length; i++) {
      b.cur[i] = b.rest[i]
      b.prev[i] = b.rest[i]
    }
    // 左边缘（系杆侧）整列钉死
    for (let iy = 0; iy <= GRID_Y; iy++) b.pinned[index(0, iy)] = 1
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

  /** 风：稳态风把旗面吹向右 + 行波涟漪（自由端摆幅最大），常数按像素尺度标定 */
  function step(b) {
    const { cur, prev, pinned, rest } = b
    for (let iy = 0; iy <= GRID_Y; iy++) {
      for (let ix = 0; ix <= GRID_X; ix++) {
        const i = index(ix, iy)
        if (pinned[i]) continue
        const cx = ix / GRID_X
        const cy = iy / GRID_Y
        const travel = simT * 4.2 - cx * 3.0 + b.phase
        const gust = 0.55 + 0.45 * Math.sin(simT * 1.2 + b.phase * 2)
        const az = (Math.sin(travel) + 0.5 * Math.sin(travel * 1.7)) * (24 + 62 * cx) * gust
        const ax = 260 + Math.sin(simT * 1.4 + b.phase) * (18 + 26 * cx) * gust
        const ay = -16 * cx * gust
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
    // 左边缘（系杆侧）钉死在杆顶
    for (let iy = 0; iy <= GRID_Y; iy++) {
      const i = index(0, iy)
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

  /** 摆放旗杆（杆底插在航点上）与旗面（系杆侧贴杆顶） */
  function place(b, p) {
    b.pole.position.set(p.x, p.y - POLE_H / 2 + 1, 0)
    b.knob.position.set(p.x, p.y - POLE_H, 0)
    b.mesh.position.set(p.x + 1.2, p.y - POLE_H, 0)
  }

  function frame() {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    if (document.hidden) return
    simT += DT
    for (const b of banners) {
      const on = b.dateMs <= latestTimeMs && latestVisible[b.armyKey] !== false
      if (!on) {
        if (b.mesh.visible) {
          b.mesh.visible = false
          b.pole.visible = false
          b.knob.visible = false
        }
        continue
      }
      const p = project(b.lng, b.lat)
      const offscreen =
        p.x < -CULL_MARGIN || p.x > width + CULL_MARGIN ||
        p.y < -CULL_MARGIN || p.y > height + CULL_MARGIN
      if (offscreen) {
        if (b.mesh.visible) {
          b.mesh.visible = false
          b.pole.visible = false
          b.knob.visible = false
        }
        continue
      }
      b.mesh.visible = true
      b.pole.visible = true
      b.knob.visible = true
      if (b.falling) {
        resetSim(b)
        b.falling = false
      }
      place(b, p)
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

  /** 静帧模式：一口气推进到稳态后渲染一次（旗面飘展开成形） */
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
        place(b, p)
        step(b)
      }
    }
    for (const b of banners) {
      const p = project(b.lng, b.lat)
      place(b, p)
      commit(b)
      const on = b.dateMs <= latestTimeMs && latestVisible[b.armyKey] !== false
      b.mesh.visible = on
      b.pole.visible = on
      b.knob.visible = on
    }
    renderer.render(scene, camera)
  }

  return {
    /** 全量替换锦旗数据（含经纬度、文案、军色、浮现日期） */
    setItems(items) {
      for (const b of banners) {
        scene.remove(b.mesh)
        scene.remove(b.pole)
        scene.remove(b.knob)
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
      document.removeEventListener('visibilitychange', onVisibility)
      for (const b of banners) {
        scene.remove(b.mesh)
        scene.remove(b.pole)
        scene.remove(b.knob)
        b.geometry.dispose()
        b.material.dispose()
        b.material.map.dispose()
      }
      banners.length = 0
      poleGeo.dispose()
      poleMat.dispose()
      knobGeo.dispose()
      knobMat.dispose()
      renderer.dispose()
      renderer.forceContextLoss?.()
      canvas.remove()
    },
  }
}
