<!--
  @file WovenCloth：实时 Verlet 织布模拟（three.js r160）
  职责：3D 地形设置面板的「织布」底板——象牙织布 + 双道绛红绲边 + 顶部钉住随风飘动。

  移植自 threeui 注册源（SHA-256 9bfd56ef7579） Sleeping：
  src/shaders/neuform-isolated/sources/lumina-weavers-cloth.html 的
  makeClothTexture() 织造算法与 Verlet 布料求解（wind / step / solve / commit）。

  与原源的差异（按产品要求裁剪，不是近似）：
  - 纹理去掉品牌字标与页面文案（LUMINA / KYOTO / Commission …），只保留织造本体：
    象牙渐变、绲边、经纬织线、竹节噪点。字标是那套示例页面的内容，不属于本应用。
  - 顶点数与求解迭代沿用源码（40×26 / 3 次），但面料尺寸按面板宽高比自适应，
    使绲边落在面板边缘而非浮在中间。
  - 只保留表示层：无 DOM overlay、无 GSAP 入场动画。
  - 粒子/求值全部基于面板自身尺寸；页面隐藏时停帧，恢复时续跑（与源码 visibilitychange 一致）。
-->
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const hostEl = ref(null)

/** 织布几何：网格密度与源码一致；布料长宽比由面板实测尺寸决定 */
const GRID_X = 40
const GRID_Y = 26
const GRAVITY = -3.1
const DAMPING = 0.985
const DT = 1 / 60
/** 相机垂直视场角（与源码一致） */
const FOV = 42

let renderer = null
let scene = null
let camera = null
let mesh = null
let geometry = null
let material = null
let texture = null
let resizeObserver = null
let raf = 0
let disposed = false

let cur = null
let prev = null
let rest = null
let pinned = null
let nodeCount = 0
let restH = 0
let restV = 0
let simTime = 0
let running = false

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 织物纹理：只画布面本体（无任何文字）。
 * @param {number} aspect 面板宽高比，用于让绲边落在画布边缘
 */
function makeClothTexture(aspect) {
  const W = 512
  const H = Math.max(256, Math.round(W / Math.max(aspect, 0.35)))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // 象牙ground渐变（源码 #efe6d4 → #e9dfca → #e3d7bf）
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#efe6d4')
  g.addColorStop(0.5, '#e9dfca')
  g.addColorStop(1, '#e3d7bf')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 双道绛红绲边（源码 strokeRect 46/66 的等比内缩）
  const hem = Math.max(4, Math.round(W * 0.014))
  const inset = Math.round(W * 0.012)
  ctx.strokeStyle = '#a5202c'
  ctx.lineWidth = hem
  ctx.strokeRect(inset + hem / 2, inset + hem / 2, W - (inset + hem / 2) * 2, H - (inset + hem / 2) * 2)
  ctx.lineWidth = Math.max(1, Math.round(hem * 0.3))
  ctx.strokeStyle = '#7c1622'
  const inner = inset + hem + Math.round(W * 0.004)
  ctx.strokeRect(inner, inner, W - inner * 2, H - inner * 2)

  // 经纬织线（源码步长 3px、0.05 暗 / 0.06 亮）
  const weaveStep = Math.max(2, Math.round(W / 200))
  for (let y = 0; y < H; y += weaveStep) {
    ctx.strokeStyle = 'rgba(60,30,20,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
    ctx.stroke()
  }
  for (let x = 0; x < W; x += weaveStep) {
    ctx.strokeStyle = 'rgba(255,250,235,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }

  // 织物竹节噪点（源码 ±10；纹理分辨率低于源图，幅度等比收小避免发脏）
  const image = ctx.getImageData(0, 0, W, H)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 2 - 1) * 6
    data[i] += n
    data[i + 1] += n
    data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 风力场：与源码同构（顺风传播 + 阵风包络 + 横向摆动），幅度按面板用途收小。
 * 源作用在整屏大画布上，WIND_SCALE 压到 0.32 后褶皱可见但不会把面板文字推向暗侧；
 * 下摆用 FLOOR_Y 托住，防止布料在长面板里坠成尖锥、两侧露底。
 */
const WIND_SCALE = 0.32
let floorY = -0.62

function wind(ix, iy, t) {
  const cx = ix / GRID_X
  const cy = iy / GRID_Y
  const travel = t * 1.7 - cy * 4.2
  const gust = 0.6 + 0.42 * Math.sin(t * 0.6) + 0.18 * Math.sin(t * 1.9 + 1.3)
  const amp = 4.3 * cy * WIND_SCALE
  const fz = (Math.sin(travel + cx * 3.3) + 0.5 * Math.sin(travel * 1.7 + cx * 6.0)) * amp * gust
  const fx = Math.sin(t * 0.9 + cy * 2.2) * 0.6 * cy * WIND_SCALE
  const fy = -0.4 * cy
  return [fx, fy, fz]
}

/** 下摆兜底：越接近面板底部，越强的回正力把布面拉回平面 */
function floorForce(iy, y) {
  if (y >= floorY) return 0
  const over = floorY - y
  return over * over * 9 * (0.4 + 0.6 * (iy / GRID_Y))
}

const index = (ix, iy) => ix + iy * (GRID_X + 1)

function solve(a, b, restLength) {
  const ax = cur[a * 3]
  const ay = cur[a * 3 + 1]
  const az = cur[a * 3 + 2]
  const bx = cur[b * 3]
  const by = cur[b * 3 + 1]
  const bz = cur[b * 3 + 2]
  let dx = bx - ax
  let dy = by - ay
  let dz = bz - az
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
  const diff = ((d - restLength) / d) * 0.5
  dx *= diff
  dy *= diff
  dz *= diff
  const pa = pinned[a]
  const pb = pinned[b]
  if (!pa && !pb) {
    cur[a * 3] += dx; cur[a * 3 + 1] += dy; cur[a * 3 + 2] += dz
    cur[b * 3] -= dx; cur[b * 3 + 1] -= dy; cur[b * 3 + 2] -= dz
  } else if (pa && !pb) {
    cur[b * 3] -= dx * 2; cur[b * 3 + 1] -= dy * 2; cur[b * 3 + 2] -= dz * 2
  } else if (!pa && pb) {
    cur[a * 3] += dx * 2; cur[a * 3 + 1] += dy * 2; cur[a * 3 + 2] += dz * 2
  }
}

function step(t) {
  for (let iy = 0; iy <= GRID_Y; iy++) {
    for (let ix = 0; ix <= GRID_X; ix++) {
      const i = index(ix, iy)
      if (pinned[i]) continue
      const [fx, fy, fz] = wind(ix, iy, t)
      const lift = floorForce(iy, cur[i * 3 + 1])
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k
        const a = k === 0 ? fx : k === 1 ? fy + GRAVITY + lift : fz
        const v = (cur[j] - prev[j]) * DAMPING
        prev[j] = cur[j]
        cur[j] = cur[j] + v + a * DT * DT
      }
    }
  }

  for (let it = 0; it < 3; it++) {
    for (let iy = 0; iy <= GRID_Y; iy++) {
      for (let ix = 0; ix < GRID_X; ix++) solve(index(ix, iy), index(ix + 1, iy), restH)
    }
    for (let iy = 0; iy < GRID_Y; iy++) {
      for (let ix = 0; ix <= GRID_X; ix++) solve(index(ix, iy), index(ix, iy + 1), restV)
    }
  }

  // 顶边钉死：钉住点始终回到静止位（源码同一处理）
  for (let ix = 0; ix <= GRID_X; ix++) {
    const i = ix
    for (let k = 0; k < 3; k++) {
      cur[i * 3 + k] = rest[i * 3 + k]
      prev[i * 3 + k] = rest[i * 3 + k]
    }
  }
}

function commit() {
  const pos = geometry.attributes.position
  for (let i = 0; i < nodeCount; i++) {
    pos.setXYZ(i, cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2])
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

/** 按面板实测尺寸重建布料与相机，使布面撑满容器且绲边贴边 */
function build(width, height) {
  const aspect = width / Math.max(height, 1)
  // 先由「布宽铺满」定距离，再反推该距离下的可见高度，
  // 让布料至少覆盖整块面板（否则下摆会浮在面板中间露出底色）。
  const BW = 4.4
  const FILL = 1.03
  const fitW = (BW / 2) / Math.tan((FOV * Math.PI) / 360) / aspect
  const distance = fitW * FILL + 0.1
  const visibleH = 2 * distance * Math.tan((FOV * Math.PI) / 360)
  const BH = Math.max(BW / Math.max(aspect, 0.2), visibleH * 1.02)

  if (geometry) geometry.dispose()
  if (material) material.dispose()
  if (texture) texture.dispose()

  geometry = new THREE.PlaneGeometry(BW, BH, GRID_X, GRID_Y)
  texture = makeClothTexture(aspect)
  if (texture) texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  material = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    shininess: 6,
    specular: 0x2a1410,
    color: 0xffffff,
  })
  if (mesh) scene.remove(mesh)
  mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  // 让布料上缘贴住面板顶部：相机中心对齐布料中心
  mesh.position.y = 0

  const pos = geometry.attributes.position
  nodeCount = (GRID_X + 1) * (GRID_Y + 1)
  cur = new Float32Array(nodeCount * 3)
  prev = new Float32Array(nodeCount * 3)
  rest = new Float32Array(nodeCount * 3)
  pinned = new Uint8Array(nodeCount)

  for (let i = 0; i < nodeCount; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    cur[i * 3] = prev[i * 3] = rest[i * 3] = x
    cur[i * 3 + 1] = prev[i * 3 + 1] = rest[i * 3 + 1] = y
    cur[i * 3 + 2] = prev[i * 3 + 2] = rest[i * 3 + 2] = 0
  }
  for (let ix = 0; ix <= GRID_X; ix++) pinned[ix] = 1

  restH = BW / GRID_X
  restV = BH / GRID_Y
  // 兜底线随布高走：布面覆盖整块面板，禁止其在面板中部塌成尖锥
  floorY = -BH * 0.36

  renderer.setSize(width, height, false)
  camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 100)
  camera.position.set(0, 0, distance)
  camera.lookAt(0, 0, 0)

  // 预热到稳态，避免首帧像一块刚被拉直的薄板
  for (let s = 0; s < 40; s++) step(s * DT)
  simTime = 40 * DT
  commit()
}

function renderFrame() {
  if (disposed) return
  running = false
  simTime += DT
  step(simTime)
  commit()
  renderer.render(scene, camera)
  raf = requestAnimationFrame(renderFrame)
}

function start() {
  if (disposed || running) return
  running = true
  raf = requestAnimationFrame(renderFrame)
}

function stop() {
  running = false
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function onVisibility() {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  const host = hostEl.value
  if (!host) return

  scene = new THREE.Scene()
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const canvas = renderer.domElement
  canvas.classList.add('woven-cloth-canvas')
  host.appendChild(canvas)

  // 光照沿用源码：暖白环境光 + 暖主光 + 绛红轮廓光
  scene.add(new THREE.AmbientLight(0xffe9d0, 0.62))
  const key = new THREE.DirectionalLight(0xfff0dc, 1.15)
  key.position.set(-3, 3.5, 3.2)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xb02330, 0.42)
  rim.position.set(3, -1.5, 2.0)
  scene.add(rim)

  const rect = host.getBoundingClientRect()
  build(Math.max(1, rect.width), Math.max(1, rect.height))

  if (reduceMotion()) {
    // 静止帧：多迭代到稳态后只渲染一次
    for (let s = 0; s < 220; s++) step(s * DT)
    commit()
    renderer.render(scene, camera)
  } else {
    start()
    document.addEventListener('visibilitychange', onVisibility)
  }

  resizeObserver = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (!box || box.width < 1 || box.height < 1) return
    build(Math.round(box.width), Math.round(box.height))
    if (!reduceMotion()) start()
  })
  resizeObserver.observe(host)

  host.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    stop()
  })
})

// 折叠后再展开：容器尺寸变了，ResizeObserver 会负责重建；这里只保证帧循环恢复
watch(
  () => hostEl.value?.offsetParent,
  (visible) => {
    if (!visible || reduceMotion()) return
    start()
  },
)

onBeforeUnmount(() => {
  disposed = true
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (geometry) geometry.dispose()
  if (material) material.dispose()
  if (texture) texture.dispose()
  scene?.traverse((node) => {
    if (node.isLight) node.dispose?.()
  })
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss?.()
    renderer.domElement?.remove()
    renderer = null
  }
  scene = null
  camera = null
  mesh = null
  geometry = null
  material = null
  texture = null
  cur = prev = rest = pinned = null
})
</script>

<template>
  <div ref="hostEl" class="woven-cloth" aria-hidden="true"></div>
</template>
