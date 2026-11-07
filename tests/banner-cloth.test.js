import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BANNER_CLOTH as C, PLACE_BANNER as B } from '../src/core/constants/banners.js'
import { createBannerCloth, resetBannerCloth, stepBannerCloth } from '../src/map/bannerCloth.js'

test('the swallowtail is actual cloth geometry with the hoist edge pinned', () => {
  const cloth = createBannerCloth(80)
  assert.equal(cloth.rest[B.gridX * 3], 80)
  const tailCenter = B.gridX + B.gridY / 2 * (B.gridX + 1)
  assert.equal(cloth.rest[tailCenter * 3], 80 - B.tailWidth)
  assert.equal(cloth.pinned.reduce((sum, value) => sum + value, 0), B.gridY + 1)
})

test('wind deforms the cloth in depth while preserving its attached edge and readable height', () => {
  const cloth = createBannerCloth(80, 1.3)
  for (let frame = 0; frame < 600; frame++) stepBannerCloth(cloth, frame * C.timeStep)
  let depth = 0
  let sag = 0
  for (let i = 0; i < cloth.pinned.length; i++) {
    for (let k = 0; k < 3; k++) {
      assert.ok(Number.isFinite(cloth.cur[i * 3 + k]))
      if (cloth.pinned[i]) assert.equal(cloth.cur[i * 3 + k], cloth.rest[i * 3 + k])
    }
    depth = Math.max(depth, Math.abs(cloth.cur[i * 3 + 2]))
    sag = Math.max(sag, Math.abs(cloth.cur[i * 3 + 1] - cloth.rest[i * 3 + 1]))
  }
  assert.ok(depth > 3, `depth=${depth}`)
  assert.ok(sag < B.height / 3, `sag=${sag}`)
  const before = cloth.cur.slice()
  for (let frame = 600; frame < 630; frame++) stepBannerCloth(cloth, frame * C.timeStep)
  const movement = Math.max(...cloth.cur.map((value, i) => Math.abs(value - before[i])))
  assert.ok(movement > 2, `movement=${movement}`)
})

test('cloth constraints remain stable and resetting returns the flag to its rest shape', () => {
  const cloth = createBannerCloth(B.maxWidth, 4)
  for (let frame = 0; frame < 900; frame++) stepBannerCloth(cloth, frame * C.timeStep)
  let strain = 0
  for (let i = 0; i < cloth.constraints.length; i += 4) {
    const a = cloth.constraints[i] * 3
    const b = cloth.constraints[i + 1] * 3
    const length = Math.hypot(cloth.cur[a] - cloth.cur[b], cloth.cur[a + 1] - cloth.cur[b + 1], cloth.cur[a + 2] - cloth.cur[b + 2])
    strain = Math.max(strain, Math.abs(length / cloth.constraints[i + 2] - 1))
  }
  assert.ok(strain < 0.15, `strain=${strain}`)
  resetBannerCloth(cloth)
  assert.deepEqual(cloth.cur, cloth.rest)
  assert.deepEqual(cloth.prev, cloth.rest)
})
