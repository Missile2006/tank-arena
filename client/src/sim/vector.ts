export class Vector2 {
  constructor(public x = 0, public y = 0) {}

  add(other: Readonly<Vector2>): Vector2 { return new Vector2(this.x + other.x, this.y + other.y); }
  sub(other: Readonly<Vector2>): Vector2 { return new Vector2(this.x - other.x, this.y - other.y); }
  scale(number: number): Vector2 { return new Vector2(this.x * number, this.y * number); }
  length(): number { return Math.hypot(this.x, this.y); }
  normalize(): Vector2 { const len = this.length(); return len === 0 ? new Vector2(0, 0) : this.scale(1 / len); }
  distanceTo(other: Readonly<Vector2>): number { return this.sub(other).length(); }
  clone(): Vector2 { return new Vector2(this.x, this.y); }
}
