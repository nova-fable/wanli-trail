export function primaryArmyPosition(positions, visibility, selectedArmy) {
  return visibility[selectedArmy] ? positions[selectedArmy] || null : null
}
