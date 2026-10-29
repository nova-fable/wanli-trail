import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { primaryArmyPosition } from '../src/map/parallel.js'
import { createWalkerMotion, resetWalkerMotion, updateWalkerDirection } from '../src/map/walkerMotion.js'

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
})
const { preparedRoutes } = await vite.ssrLoadModule('/src/composables/useRoutes.js')
const { parseDate, positionAt } = await vite.ssrLoadModule('/src/utils/geo.js')
after(() => vite.close())

test('several armies progress independently at the same playback time', () => {
  const time = parseDate('1935-06-15')
  const positions = Object.fromEntries(
    Object.entries(preparedRoutes).map(([key, route]) => [key, positionAt(route, time, { noTravel: true })]),
  )
  assert.equal(positions.first.started && !positions.first.done, true)
  assert.equal(positions.fourth.started && !positions.fourth.done, true)
  assert.equal(positions.n25.started && !positions.n25.done, true)
  assert.equal(positions.second.started, false)
  assert.notDeepEqual(positions.first.head, positions.fourth.head)
  assert.notDeepEqual(positions.fourth.head, positions.n25.head)
})

test('main camera never switches to another army when the first is unavailable', () => {
  const first = { started: true, head: [1, 2] }
  const positions = { first, fourth: { started: true, head: [3, 4] } }
  assert.equal(primaryArmyPosition(positions, { first: true, fourth: true }), first)
  assert.equal(primaryArmyPosition(positions, { first: false, fourth: true }), null)
  assert.equal(primaryArmyPosition({ ...positions, first: { started: false } }, { first: true }), null)
})

test('seeking backwards restores the earlier troop positions and states', () => {
  const route = preparedRoutes.n25
  const before = positionAt(route, parseDate('1934-10-01'), { noTravel: true })
  const during = positionAt(route, parseDate('1935-06-15'), { noTravel: true })
  const afterArrival = positionAt(route, parseDate('1936-10-31'), { noTravel: true })
  const rewind = positionAt(route, parseDate('1935-06-15'), { noTravel: true })
  assert.equal(before.started, false)
  assert.equal(during.started && !during.done, true)
  assert.equal(afterArrival.done, true)
  assert.deepEqual(rewind.head, during.head)
  assert.equal(rewind.idx, during.idx)
})

test('walker direction follows horizontal movement and resets after a jump', () => {
  const motion = createWalkerMotion()
  updateWalkerDirection(motion, -4, 0)
  assert.equal(motion.dir, -1)
  updateWalkerDirection(motion, 0, 40)
  assert.equal(motion.dir, -1)
  for (let i = 0; i < 30; i++) updateWalkerDirection(motion, 8, 0)
  assert.equal(motion.dir, 1)
  motion.lastHead = [1, 2]
  resetWalkerMotion(motion)
  assert.deepEqual(motion, { lastHead: null, dir: 1, emaX: 0, emaY: 0 })
})
