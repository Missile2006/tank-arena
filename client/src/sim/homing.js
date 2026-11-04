
import { Vector2 } from './vector.js';

// Додає об'єкту поведінку самонаведення
export function applyHoming(entity, target, dt, strength = 3) {
  if (!entity || !target || entity.dead || target.dead) {
    return;
  }

  // Напрямок від об'єкта до цілі
  const direction = target.position
    .sub(entity.position)
    .normalize();

  // Поточна швидкість об'єкта
  const speed = entity.velocity.length();

  // Якщо об'єкт не рухається, задаємо початкову швидкість
  const currentSpeed = speed > 0 ? speed : 100;

  // Бажана швидкість у напрямку цілі
  const desiredVelocity = direction.scale(currentSpeed);

  // Поступово змінюємо напрямок руху
  const factor = Math.min(1, Math.max(0, strength * dt));

  const newVelocity = entity.velocity
    .scale(1 - factor)
    .add(desiredVelocity.scale(factor));

  entity.velocity = new Vector2(
    newVelocity.x,
    newVelocity.y,
  );
}
