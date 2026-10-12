
import { handleCollisions } from './collision.js';

export class World {
  constructor() {
    // Усі сутності гри: id -> об'єкт
    this.entities = new Map();

    // Ідентифікатори об'єктів для видалення
    this.toRemove = new Set();
    this.score = 0;
  }

  // Додавання нової сутності
  spawn(entity) {
    this.entities.set(entity.id, entity);
    return entity;
  }

  // Позначення сутності для видалення
  despawn(entity) {
    if (!this.entities.has(entity.id)) {
      return;
    }

    entity.destroy();
    this.toRemove.add(entity.id);
  }

  // Генератор сутностей певного типу
  *ofKind(kind) {
    for (const entity of this.entities.values()) {
      if (entity.kind === kind && !entity.dead) {
        yield entity;
      }
    }
  }

  // Оновлення ігрового світу

  step(dt) {
    // Оновлюємо всі активні сутності
    for (const entity of this.entities.values()) {
      if (!entity.dead) {
        entity.update(dt);
      }

      if (entity.dead) {
        this.toRemove.add(entity.id);
      }
    }

    // Перевіряємо зіткнення після оновлення позицій
    handleCollisions(this);

    // Видаляємо знищені сутності наприкінці кроку
    this.sweep();
  }


  // Очищення знищених сутностей
  sweep() {
    for (const id of this.toRemove) {
      this.entities.delete(id);
    }

    this.toRemove.clear();
  }

  // Кількість активних сутностей
  get size() {
    return this.entities.size;
  }
}
