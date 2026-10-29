
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { Bullet } from './bullet.js';

export function integrate(ship, input, dt) {
  const acceleration = 220;
  const maxSpeed = 180;
  const rotationSpeed = 2.8;
  const friction = 0.97;

  const next = { ...ship };

  if (input.left) {
    next.angle -= rotationSpeed * dt;
  }

  if (input.right) {
    next.angle += rotationSpeed * dt;
  }

  let movement = 0;

  if (input.forward) {
    movement += 1;
  }

  if (input.backward) {
    movement -= 1;
  }

  const ax = Math.sin(next.angle) * acceleration * movement;
  const ay = -Math.cos(next.angle) * acceleration * movement;

  next.vx += ax * dt;
  next.vy += ay * dt;

  const damping = friction ** (dt * 60);

  next.vx *= damping;
  next.vy *= damping;

  const speed = Math.hypot(next.vx, next.vy);

  if (speed > maxSpeed) {
    const factor = maxSpeed / speed;
    next.vx *= factor;
    next.vy *= factor;
  }

  next.x += next.vx * dt;
  next.y += next.vy * dt;

  return next;
}

// Клас танка, який успадковується від Entity
export class Ship extends Entity {
  #hp = 100;

  constructor(x, y) {
    super({
      position: new Vector2(x, y),
      velocity: new Vector2(0, 0),
      radius: 25,
      kind: 'ship',
    });

    this.angle = 0;
    this.width = 40;
    this.height = 50;

    // Тривалість невразливості після зіткнення
    this.invulnerabilityTimer = 0;

    // Час існування танка для ефекту блимання
    this.animationTime = 0;
  }

  get hp() {
    return this.#hp;
  }

  get invulnerable() {
    return this.invulnerabilityTimer > 0;
  }

  // Отримання пошкоджень
  takeDamage(amount) {
    if (this.dead || amount <= 0 || this.invulnerable) {
      return false;
    }

    this.#hp = Math.max(0, this.#hp - amount);

    // Після удару танк невразливий 1 секунду
    this.invulnerabilityTimer = 1;

    if (this.#hp === 0) {
      this.destroy();
    }

    return true;
  }

  // Відновлення здоров'я
  heal(amount) {
    if (this.dead || amount <= 0) {
      return;
    }

    this.#hp = Math.min(100, this.#hp + amount);
  }

  get x() {
    return this.position.x;
  }

  get y() {
    return this.position.y;
  }

  get vx() {
    return this.velocity.x;
  }

  get vy() {
    return this.velocity.y;
  }

  update(dt, input = this.controls ?? {}) {
    // Зменшуємо час невразливості
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(
        0,
        this.invulnerabilityTimer - dt,
      );
    }

    this.animationTime += dt;

    const state = {
      x: this.position.x,
      y: this.position.y,
      vx: this.velocity.x,
      vy: this.velocity.y,
      angle: this.angle,
    };

    const next = integrate(state, input, dt);

    this.position = new Vector2(next.x, next.y);
    this.velocity = new Vector2(next.vx, next.vy);
    this.angle = next.angle;
  }

  wrap(width, height) {
    this.position = new Vector2(
      ((this.position.x % width) + width) % width,
      ((this.position.y % height) + height) % height,
    );
  }

  fire() {
    const direction = new Vector2(
      Math.sin(this.angle),
      -Math.cos(this.angle),
    );

    const muzzlePosition = this.position.add(
      direction.scale(40),
    );

    const bulletVelocity = direction
      .scale(350)
      .add(this.velocity);

    return new Bullet({
      position: muzzlePosition,
      velocity: bulletVelocity,
      ownerId: this.id,
      ttl: 1.5,
      damage: 25,
    });
  }
}
