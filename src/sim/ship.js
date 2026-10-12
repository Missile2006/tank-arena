export function integrate(ship, input, dt) {
  const acceleration = 220;
  const maxSpeed = 180;
  const rotationSpeed = 2.8;
  const friction = 0.97;

  // Створюємо копію стану танка
  const next = { ...ship };

  // Керування поворотом
  if (input.left) {
    next.angle -= rotationSpeed * dt;
  }

  if (input.right) {
    next.angle += rotationSpeed * dt;
  }

  // Керування рухом
  let movement = 0;

  if (input.forward) {
    movement += 1;
  }

  if (input.backward) {
    movement -= 1;
  }

  // Прискорення у напрямку танка
  const ax = Math.sin(next.angle) * acceleration * movement;
  const ay = -Math.cos(next.angle) * acceleration * movement;

  next.vx += ax * dt;
  next.vy += ay * dt;

  // Опір руху, незалежний від частоти кадрів
  const damping = friction ** (dt * 60);

  next.vx *= damping;
  next.vy *= damping;

  // Обмеження максимальної швидкості
  const speed = Math.hypot(next.vx, next.vy);

  if (speed > maxSpeed) {
    const factor = maxSpeed / speed;
    next.vx *= factor;
    next.vy *= factor;
  }

  // Оновлення координат
  next.x += next.vx * dt;
  next.y += next.vy * dt;

  return next;
}
