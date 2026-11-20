import { handleCollisions } from './collision.js';
import { emitGameEvent } from '../events/bus.js';
import { Entity } from './entity.js';
import { Particle, releaseParticle } from './particle.js';

export class World {
  entities: Map<number, Entity>;
  toRemove: Set<number>;
  score: number;

  constructor() {
    this.entities = new Map<number, Entity>();
    this.toRemove = new Set<number>();
    this.score = 0;
  }

  spawn<T extends Entity>(entity: T): T {
    this.entities.set(entity.id, entity);
    return entity;
  }

  despawn(entity: Entity): void {
    if (!this.entities.has(entity.id)) return;
    entity.destroy();
    this.toRemove.add(entity.id);
  }

  *ofKind(kind: string): Generator<Entity> {
    for (const entity of this.entities.values()) {
      if (entity.kind === kind && !entity.dead) yield entity;
    }
  }

  emit(type: string, detail: Record<string, unknown> = {}): void {
    emitGameEvent(type, detail);
  }

  step(dt: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.dead) entity.update(dt);
      if (entity.dead) this.toRemove.add(entity.id);
    }
    handleCollisions(this);
    this.sweep();
  }

  sweep(): void {
    for (const id of this.toRemove) {
      const entity = this.entities.get(id);
      if (entity && this.entities.delete(id) && entity instanceof Particle) {
        releaseParticle(entity);
      }
    }
    this.toRemove.clear();
  }

  get size(): number { return this.entities.size; }
}
