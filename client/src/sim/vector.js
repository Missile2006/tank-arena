
export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  sub(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(number) {
    return new Vector2(this.x * number, this.y * number);
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const len = this.length();

    if (len === 0) {
      return new Vector2(0, 0);
    }

    return this.scale(1 / len);
  }

  distanceTo(other) {
    return this.sub(other).length();
  }

  clone() {
    return new Vector2(this.x, this.y);
  }
}
