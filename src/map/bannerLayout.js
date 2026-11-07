import { PLACE_BANNER as B } from '../core/constants/banners.js'

export function bannerWidth(text) {
  return Math.min(B.maxWidth, Math.max(B.width, Array.from(text).length * B.textSize + B.textInset + B.tailWidth + 6))
}

export function layoutBanners(banners, time, visibleArmies, width, height, project) {
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i]
    b.visible = false
    if (b.dateMs > time || visibleArmies[b.armyKey] === false) continue
    const p = project(b.lng, b.lat)
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    if (
      p.x < -B.cullMargin || p.x > width + B.cullMargin ||
      p.y < -B.cullMargin || p.y > height + B.cullMargin
    ) continue
    b.screenX = p.x
    b.screenY = p.y
    b.left = p.x - B.clearance
    b.right = p.x + b.width + B.clearance
    b.top = p.y - B.poleHeight - B.clearance
    b.bottom = b.top + B.height + B.clearance * 2
    let overlap = false
    for (let j = 0; j < i; j++) {
      const other = banners[j]
      if (
        other.visible && b.left < other.right && b.right > other.left &&
        b.top < other.bottom && b.bottom > other.top
      ) {
        overlap = true
        break
      }
    }
    b.visible = !overlap
  }
}
