import { handleCollisions } from './collision.js';
import { emitGameEvent } from '../events/bus.js';
import { Entity } from './entity.js';

export class World {
  entities: Map<number, Entity>;
  toRemove: Set<number>;
  score: number;
  constructor() {
    // Усі сутності гри: id -> об'єкт
    this.entities = new Map<number, Entity>();

    // Ідентифікатори об'єктів для видалення
    this.toRemove = new Set<number>();

    // Ігровий рахунок
    this.score = 0;
  }

  // Додавання нової сутності
  spawn<T extends Entity>(entity: T): T {
    this.entities.set(entity.id, entity);
    return entity;
  }

  // Позначення сутності для видалення
  despawn(entity: Entity): void {
    if (!this.entities.has(entity.id)) {
      return;
    }

    entity.destroy();
    this.toRemove.add(entity.id);
  }

  // Генератор сутностей певного типу
  *ofKind(kind: string): Generator<Entity> {
    for (const entity of this.entities.values()) {
      if (entity.kind === kind && !entity.dead) {
        yield entity;
      }
    }
  }

  // Надсилання подій гри через EventTarget
  emit(type: string, detail: Record<string, unknown> = {}): void {
    emitGameEvent(type, detail);
  }

  // Оновлення ігрового світу
  step(dt: number): void {
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
  sweep(): void {
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
