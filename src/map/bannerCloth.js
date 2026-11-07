import { BANNER_CLOTH as C, PLACE_BANNER as B } from '../core/constants/banners.js'

const index = (x, y) => x + y * (B.gridX + 1)

export function createBannerCloth(width, phase = 0) {
  const count = (B.gridX + 1) * (B.gridY + 1)
  const rest = new Float32Array(count * 3)
  const pinned = new Uint8Array(count)
  // 左边缘（系杆侧）整列钉死
  for (let y = 0; y <= B.gridY; y++) {
    for (let x = 0; x <= B.gridX; x++) {
      const i = index(x, y)
      const u = x / B.gridX
      const v = y / B.gridY
      rest[i * 3] = u * width - B.tailWidth * (1 - Math.abs(v * 2 - 1)) * u ** 6
      rest[i * 3 + 1] = v * B.height
      pinned[i] = x === 0 ? 1 : 0
    }
  }
  const links = []
  const link = (a, b, stiffness = 1) => {
    links.push(a, b, Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1]), stiffness)
  }
  for (let y = 0; y <= B.gridY; y++) {
    for (let x = 0; x <= B.gridX; x++) {
      const i = index(x, y)
      if (x < B.gridX) link(i, index(x + 1, y))
      if (y < B.gridY) link(i, index(x, y + 1))
      if (x < B.gridX && y < B.gridY) {
        link(i, index(x + 1, y + 1), 0.7)
        link(index(x + 1, y), index(x, y + 1), 0.7)
      }
    }
  }
  return {
    rest, pinned, phase,
    cur: rest.slice(),
    prev: rest.slice(),
    constraints: new Float32Array(links),
  }
}

export function resetBannerCloth(cloth) {
  cloth.cur.set(cloth.rest)
  cloth.prev.set(cloth.rest)
}

function solve({ cur, pinned }, a, b, length, stiffness) {
  const ia = a * 3
  const ib = b * 3
  const dx = cur[ib] - cur[ia]
  const dy = cur[ib + 1] - cur[ia + 1]
  const dz = cur[ib + 2] - cur[ia + 2]
  const distance = Math.hypot(dx, dy, dz) || 1e-6
  const weight = (pinned[a] ? 0 : 1) + (pinned[b] ? 0 : 1)
  if (!weight) return
  const correction = (distance - length) / distance * stiffness / weight
  if (!pinned[a]) {
    cur[ia] += dx * correction
    cur[ia + 1] += dy * correction
    cur[ia + 2] += dz * correction
  }
  if (!pinned[b]) {
    cur[ib] -= dx * correction
    cur[ib + 1] -= dy * correction
    cur[ib + 2] -= dz * correction
  }
}

/** 风：稳态风展开旗面，受限行波与经纬抗剪约束共同保持地名可读 */
export function stepBannerCloth(cloth, time) {
  const { cur, prev, rest, pinned, phase, constraints } = cloth
  const gust = 0.7 + 0.3 * Math.sin(time * 1.1 + phase * 2)
  for (let y = 0; y <= B.gridY; y++) {
    for (let x = 1; x <= B.gridX; x++) {
      const i = index(x, y)
      const u = x / B.gridX
      const v = y / B.gridY
      const travel = time * C.waveSpeed - u * 7.5 + phase
      const wave = (Math.sin(travel + v * 0.7) + 0.28 * Math.sin(travel * 1.9 - v)) *
        C.waveAmplitude * u ** 1.2 * gust
      const lift = Math.sin(travel - 0.8) * u * 1.4
      const ax = C.windStrength * (0.8 + gust * 0.4)
      const ay = (rest[i * 3 + 1] + lift - cur[i * 3 + 1]) * 20 + C.gravity
      const az = (wave - cur[i * 3 + 2]) * 56
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k
        const acceleration = k === 0 ? ax : k === 1 ? ay : az
        const velocity = (cur[j] - prev[j]) * C.damping
        prev[j] = cur[j]
        cur[j] += velocity + acceleration * C.timeStep ** 2
      }
    }
  }
  for (let pass = 0; pass < C.iterations; pass++) {
    for (let j = 0; j < constraints.length; j += 4) {
      solve(cloth, constraints[j], constraints[j + 1], constraints[j + 2], constraints[j + 3])
    }
  }
  // 左边缘（系杆侧）钉死在杆顶
  for (let i = 0; i < pinned.length; i++) {
    if (!pinned[i]) continue
    for (let k = 0; k < 3; k++) cur[i * 3 + k] = prev[i * 3 + k] = rest[i * 3 + k]
  }
}
