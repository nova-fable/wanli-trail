import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLACE_BANNER } from '../src/core/constants/banners.js'
import { bannerWidth, layoutBanners } from '../src/map/bannerLayout.js'

const project = (lng, lat) => ({ x: lng, y: lat })
const item = (key, lng, lat, dateMs = 10, armyKey = 'first') => ({
  key, lng, lat, dateMs, armyKey, width: bannerWidth(key), visible: false,
})

test('place names grow the flag instead of shrinking the lettering', () => {
  assert.equal(bannerWidth('于都'), PLACE_BANNER.width)
  assert.ok(bannerWidth('茅台·三渡') > bannerWidth('于都'))
  assert.ok(bannerWidth('非常长的地名'.repeat(10)) <= PLACE_BANNER.maxWidth)
})

test('overlapping flags keep the newest passed place with stable ordering', () => {
  const banners = [item('旧地', 100, 150, 10), item('新地', 105, 153, 20)]
  banners.sort((a, b) => b.dateMs - a.dateMs)
  layoutBanners(banners, 25, { first: true }, 800, 600, project)
  assert.equal(banners[0].visible, true)
  assert.equal(banners[1].visible, false)
  layoutBanners(banners, 15, { first: true }, 800, 600, project)
  assert.equal(banners[0].visible, false)
  assert.equal(banners[1].visible, true)
})

test('hidden armies, future places and offscreen flags do not block other flags', () => {
  const banners = [
    item('隐藏', 100, 150, 10, 'fourth'),
    item('未来', 100, 150, 30),
    item('屏外', -500, 150),
    item('可见', 100, 150),
  ]
  layoutBanners(banners, 20, { first: true, fourth: false }, 800, 600, project)
  assert.deepEqual(banners.map(b => b.visible), [false, false, false, true])
})

test('projection changes and equal-count army switches update the layout immediately', () => {
  const banners = [
    item('红一', 100, 150, 10),
    item('红四', 105, 150, 10, 'fourth'),
  ]
  layoutBanners(banners, 20, { first: true, fourth: false }, 800, 600, project)
  assert.deepEqual(banners.map(b => b.visible), [true, false])
  layoutBanners(banners, 20, { first: false, fourth: true }, 800, 600, project)
  assert.deepEqual(banners.map(b => b.visible), [false, true])
  layoutBanners(banners, 20, { first: true, fourth: true }, 800, 600, (lng, lat) => ({
    x: (lng - 100) * 30 + 100, y: lat,
  }))
  assert.deepEqual(banners.map(b => b.visible), [true, true])
  assert.equal(banners[1].screenX, 250)
})
