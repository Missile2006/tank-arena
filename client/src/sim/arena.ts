export interface WrappablePosition { x: number; y: number; }
export function wrapPosition<T extends WrappablePosition>(ship: T, width: number, height: number): T {
  return { ...ship, x: ((ship.x % width) + width) % width, y: ((ship.y % height) + height) % height };
}
