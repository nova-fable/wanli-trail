/*
  @file 织布底纹生成：把 WovenCloth（neuform-isolated / lumina-weavers-cloth）源码里
        makeClothTexture() 的织造算法移植为可平铺的面板底纹。

  来源锚点（改算法前先对照）：threeui 注册源
  src/shaders/neuform-isolated/sources/lumina-weavers-cloth.html，
  makeClothTexture() —— 象牙渐变底 + 双道绛红绲边 + 每隔 3px 的经纬织线 + 织物竹节噪点。

  与原实现的差异（面板化所需，非风格改动）：
  - 原纹理是 1280x800 的单幅"帘布"，字标与绲边都画在纹样里；
    面板要随内容变高，只取可平铺的「布面本体」四层（渐变/织线/噪点），
    绲边与字标改由 CSS 画在面板边缘，才能贴合任意尺寸。
  - 噪点幅度沿用源码的 ±10，周期取 64 保证 3px 织线网格无缝。
  - SSR/无 canvas 环境返回空串，由样式里的暖金兜底底色接管。
*/

const TILE = 64
let cached = ''

export function wovenTextureUrl() {
  if (cached !== '') return cached
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = TILE
  canvas.height = TILE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // 象牙ground渐变：源码 #efe6d4 → #e9dfca → #e3d7bf，装进单块平铺内循环
  const gradient = ctx.createLinearGradient(0, 0, 0, TILE)
  gradient.addColorStop(0, '#efe6d4')
  gradient.addColorStop(0.5, '#e9dfca')
  gradient.addColorStop(1, '#e3d7bf')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, TILE, TILE)

  // 织线网格：纬线暗、经线亮（源码 0.05 暗 / 0.06 亮，步长 3px）
  ctx.globalAlpha = 1
  for (let y = 0; y < TILE; y += 3) {
    ctx.strokeStyle = 'rgba(60,30,20,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(TILE, y + 0.5)
    ctx.stroke()
  }
  for (let x = 0; x < TILE; x += 3) {
    ctx.strokeStyle = 'rgba(255,250,235,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, TILE)
    ctx.stroke()
  }

  // 织物竹节噪点：源码逐像素加减 ±10
  const image = ctx.getImageData(0, 0, TILE, TILE)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 2 - 1) * 10
    data[i] += n
    data[i + 1] += n
    data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)

  cached = `url("${canvas.toDataURL('image/png')}")`
  return cached
}
