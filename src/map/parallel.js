export function primaryArmyPosition(positions, visibility) {
  const first = positions.first
  return visibility.first && first?.started ? first : null
}
