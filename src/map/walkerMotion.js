export function createWalkerMotion() {
  return { lastHead: null, dir: 1, emaX: 0, emaY: 0 }
}

export function resetWalkerMotion(motion) {
  motion.lastHead = null
  motion.dir = 1
  motion.emaX = 0
  motion.emaY = 0
}

export function updateWalkerDirection(motion, dx, dy) {
  motion.emaX = motion.emaX * 0.82 + dx * 0.18
  motion.emaY = motion.emaY * 0.82 + dy * 0.18
  const speed = Math.hypot(motion.emaX, motion.emaY)
  if (speed > 1e-7 && Math.abs(motion.emaX) > 0.3 * speed) {
    motion.dir = motion.emaX > 0 ? 1 : -1
  }
}
