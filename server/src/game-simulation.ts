
import {
  createShip,
  integrate,
  normalizeInput,
  FIXED_DT,
} from '../../shared/simulation.ts';
import type { InputState, ShipState } from '../../shared/simulation.ts';
import type { Room } from './room.ts';

export interface ServerShip extends ShipState {
  hp: number;
  invulnerableUntil: number;
  respawnAt: number;
  destroyed: boolean;
}
export interface ServerBullet {
  id: number; ownerId: string; x: number; y: number;
  vx: number; vy: number; ttl: number;
}
export interface ServerAsteroid {
  id: number; x: number; y: number; vx: number; vy: number;
  radius: number; hp: number; turnPhase: number;
}
export interface ServerPickup {
  id: number;
  x: number;
  y: number;
  radius: number;
  healAmount: number;
}
export interface ServerSnapshot {
  type: 'snapshot'; tick: number;
  players: Array<Pick<ServerShip, 'id' | 'x' | 'y' | 'vx' | 'vy' | 'angle' | 'hp' | 'destroyed'> & {lastProcessedSeq: number}>;
  bullets: Array<Pick<ServerBullet, 'id' | 'ownerId' | 'x' | 'y' | 'vx' | 'vy'>>;
  asteroids: Array<Pick<ServerAsteroid, 'id' | 'x' | 'y' | 'radius' | 'hp'>>;
  pickups: ServerPickup[];
}
export class GameSimulation {
  readonly room: Room;
  readonly ships = new Map<string, ServerShip>();
  readonly inputs = new Map<string, InputState>();
  readonly inputQueues = new Map<string, InputState[]>();
  readonly lastProcessedSeq = new Map<string, number>();
  bullets: ServerBullet[] = [];
  nextBulletId = 1;
  readonly lastFireTick = new Map<string, number>();
  asteroids: ServerAsteroid[] = [];
  pickups: ServerPickup[] = [];

  private pickupRespawnAt = 0;

  private createPickup(): ServerPickup {
    const margin = 50;

    return {
      id: 1,
      x: margin + Math.random() * (900 - margin * 2),
      y: margin + Math.random() * (550 - margin * 2),
      radius: 15,
      healAmount: 25,
    };
  }
  tick = 0;
  private nextAsteroidId = 1;
  private readonly asteroidRespawns: number[] = [];

  constructor(room: Room) {
    this.room = room;
    this.pickups = [this.createPickup()];

    // Гравці та їхні команди

    // Черги команд для серверної симуляції

    // Серверні кулі

    // Серверні астероїди

    this.resetAsteroids();

  }

  private createAsteroid(): ServerAsteroid {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 35;
    return {
      id: this.nextAsteroidId++,
      x: 100 + Math.random() * 700,
      y: 80 + Math.random() * 390,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 25,
      hp: 50,
      turnPhase: Math.random() * Math.PI * 2,
    };
  }

  // Called when an empty room is entered again; active rooms keep their state.
  resetAsteroids(): void {
    this.asteroidRespawns.length = 0;
    this.asteroids = Array.from(
      { length: this.room.asteroidCount },
      () => this.createAsteroid(),
    );
  }

  private updateAsteroidRespawns(): void {
    const now = this.tick * FIXED_DT;
    while (this.asteroidRespawns.length > 0 &&
      this.asteroidRespawns[0] !== undefined &&
      this.asteroidRespawns[0] <= now) {
      this.asteroidRespawns.shift();
      if (this.asteroids.length < this.room.asteroidCount) {
        this.asteroids.push(this.createAsteroid());
      }
    }
  }

  // Додавання гравця
  addPlayer(playerId: string): void {
    if (this.ships.has(playerId)) {
      return;
    }

    const index = this.ships.size;
    const x = index % 2 === 0 ? 250 : 650;
    const y = 275;

    const ship: ServerShip = {
      ...createShip(playerId, x, y),
      hp: 100, invulnerableUntil: 0, respawnAt: 0, destroyed: false,
    };

    // Початковий стан здоров'я
    ship.hp = 100;
    ship.invulnerableUntil = 0;
    ship.respawnAt = 0;
    ship.destroyed = false;

    this.ships.set(playerId, ship);

    this.inputs.set(playerId, {
      thrust: false,
      backward: false,
      left: false,
      right: false,
      fire: false,
      seq: 0,
    });

    this.inputQueues.set(playerId, []);
    this.lastProcessedSeq.set(playerId, 0);
  }

  // Видалення гравця
  removePlayer(playerId: string): void {
    this.ships.delete(playerId);
    this.inputs.delete(playerId);
    this.inputQueues.delete(playerId);
    this.lastProcessedSeq.delete(playerId);
    this.lastFireTick.delete(playerId);

    this.bullets = this.bullets.filter(
      (bullet) => bullet.ownerId !== playerId,
    );
  }

  // Отримання команди від клієнта
  setInput(playerId: string, rawInput: Partial<InputState>): boolean {
    if (!this.ships.has(playerId)) {
      return false;
    }

    const input = normalizeInput(rawInput);
    const queue = this.inputQueues.get(playerId);
    const previous = this.inputs.get(playerId);
    if (!queue || !previous) return false;

    const latestSeq =
      queue.length > 0
        ? queue[queue.length - 1]?.seq ?? previous.seq
        : previous.seq;

    if (input.seq <= latestSeq) {
      return false;
    }

    // Обмеження черги команд
    if (queue.length >= 120) {
      return false;
    }

    queue.push(input);

    return true;
  }

  // Створення серверної кулі
  fireBullet(playerId: string): void {
    const ship = this.ships.get(playerId);

    if (!ship || ship.destroyed) {
      return;
    }

    const lastTick =
      this.lastFireTick.get(playerId) ?? -Infinity;

    // Приблизно 5 пострілів за секунду
    if (this.tick - lastTick < 6) {
      return;
    }

    this.lastFireTick.set(playerId, this.tick);

    const directionX = Math.sin(ship.angle);
    const directionY = -Math.cos(ship.angle);

    this.bullets.push({
      id: this.nextBulletId++,
      ownerId: playerId,

      x: ship.x + directionX * 40,
      y: ship.y + directionY * 40,

      vx: ship.vx + directionX * 250,
      vy: ship.vy + directionY * 250,

      ttl: 1.5,
    });
  }

  // Основний цикл серверної симуляції
  update(dt = FIXED_DT): void {
    // 1. Оновлення астероїдів
    for (const asteroid of this.asteroids) {
      const time = this.tick * FIXED_DT;

      // Плавна зміна напрямку руху
      const turn =
        Math.sin(time * 0.8 + asteroid.turnPhase) *
        0.025;

      const angle =
        Math.atan2(asteroid.vy, asteroid.vx) + turn;

      const speed = Math.hypot(
        asteroid.vx,
        asteroid.vy,
      );

      asteroid.vx = Math.cos(angle) * speed;
      asteroid.vy = Math.sin(angle) * speed;

      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;

      // Відбиття від горизонтальних меж
      if (
        asteroid.x < asteroid.radius ||
        asteroid.x > 900 - asteroid.radius
      ) {
        asteroid.vx *= -1;

        asteroid.x = Math.max(
          asteroid.radius,
          Math.min(
            900 - asteroid.radius,
            asteroid.x,
          ),
        );
      }

      // Відбиття від вертикальних меж
      if (
        asteroid.y < asteroid.radius ||
        asteroid.y > 550 - asteroid.radius
      ) {
        asteroid.vy *= -1;

        asteroid.y = Math.max(
          asteroid.radius,
          Math.min(
            550 - asteroid.radius,
            asteroid.y,
          ),
        );
      }
    }

    // 2. Оновлення танків
    for (const [playerId, ship] of this.ships) {
      const queue = this.inputQueues.get(playerId);

      // За один такт обробляємо одну команду
      if (queue && queue.length > 0) {
        const nextInput = queue.shift();
        if (!nextInput) continue;
        this.inputs.set(playerId, nextInput);

        this.lastProcessedSeq.set(
          playerId,
          nextInput.seq,
        );
      }

      const input = this.inputs.get(playerId);
      if (!input) continue;

      // Знищений танк не рухається і не стріляє
      if (!ship.destroyed) {
        integrate(ship, input, dt);

        if (input.fire) {
          this.fireBullet(playerId);
        }
      }
    }

    // 3. Оновлення куль
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.ttl -= dt;
    }

    // Видалення куль після завершення їхнього життя
    this.bullets = this.bullets.filter(
      (bullet) => bullet.ttl > 0,
    );

    // 4. Перевірка влучань куль в астероїди
    this.checkBulletAsteroidCollisions();
    this.updateAsteroidRespawns();

    // 5. Відродження знищених танків
    this.updateRespawns();

    // 6. Перевірка зіткнень танків з астероїдами
    this.checkAsteroidCollisions();

    this.checkPickupCollisions();

    // 7. Наступний серверний такт
    this.tick += 1;
  }

  checkBulletAsteroidCollisions(): void {
    const destroyedBulletIds = new Set<number>();
    const destroyedAsteroidIds = new Set<number>();

    for (const bullet of this.bullets) {
      for (const asteroid of this.asteroids) {
        const dx = bullet.x - asteroid.x;
        const dy = bullet.y - asteroid.y;

        const distance = Math.hypot(dx, dy);

        const bulletRadius = 5;
        const collisionDistance =
          bulletRadius + asteroid.radius;

        if (distance >= collisionDistance) {
          continue;
        }

        // Куля влучила в астероїд
        destroyedBulletIds.add(bullet.id);

        // Кожне влучання завдає 10 HP шкоди
        asteroid.hp = Math.max(0, asteroid.hp - 10);

        console.log(
          `Asteroid ${asteroid.id} hit! HP: ${asteroid.hp}`,
        );

        if (asteroid.hp === 0) {
          if (!destroyedAsteroidIds.has(asteroid.id)) {
            destroyedAsteroidIds.add(asteroid.id);
            this.asteroidRespawns.push(this.tick * FIXED_DT + 5);
          }

          console.log(
            `Asteroid ${asteroid.id} destroyed!`,
          );
        }

        // Одна куля пошкоджує лише один астероїд
        break;
      }
    }

    // Видаляємо кулі, які влучили
    this.bullets = this.bullets.filter(
      (bullet) => !destroyedBulletIds.has(bullet.id),
    );

    // Видаляємо знищені астероїди
    this.asteroids = this.asteroids.filter(
      (asteroid) => !destroyedAsteroidIds.has(asteroid.id),
    );
  }
  checkPickupCollisions(): void {
    const now = this.tick * FIXED_DT;

    if (this.pickups.length === 0) {
      if (this.pickupRespawnAt > 0 && now >= this.pickupRespawnAt) {
        this.pickups.push(this.createPickup());

        this.pickupRespawnAt = 0;
      }

      return;
    }

    for (const ship of this.ships.values()) {
      if (ship.destroyed || ship.hp >= 100) {
        continue;
      }

      for (const pickup of this.pickups) {
        const dx = ship.x - pickup.x;
        const dy = ship.y - pickup.y;

        const collisionDistance = 20 + pickup.radius;

        if (dx * dx + dy * dy > collisionDistance * collisionDistance) {
          continue;
        }

        ship.hp = Math.min(100, ship.hp + pickup.healAmount);

        this.pickups = this.pickups.filter(
          (item) => item.id !== pickup.id,
        );

        this.pickupRespawnAt = now + 10;

        return;
      }
    }
  }
  // Перевірка зіткнень танків з астероїдами
  checkAsteroidCollisions(): void {
    const now = this.tick * FIXED_DT;

    for (const ship of this.ships.values()) {
      // Не завдаємо шкоди знищеним
      // або тимчасово захищеним танкам
      if (
        ship.destroyed ||
        now < ship.invulnerableUntil
      ) {
        continue;
      }

      for (const asteroid of this.asteroids) {
        const dx = ship.x - asteroid.x;
        const dy = ship.y - asteroid.y;

        const distance = Math.hypot(dx, dy);

        const shipRadius = 20;

        const collisionDistance =
          shipRadius + asteroid.radius;

        if (distance >= collisionDistance) {
          continue;
        }

        // Зіткнення: мінус 10 HP
        ship.hp = Math.max(0, ship.hp - 10);

        // Захист від повторної шкоди на 1 секунду
        ship.invulnerableUntil = now + 1;

        // Перевірка знищення танка
        if (ship.hp === 0) {
          ship.destroyed = true;
          ship.respawnAt = now + 2;

          ship.vx = 0;
          ship.vy = 0;
        }

        // Лише одне пошкодження за перевірку
        break;
      }
    }
  }

  // Відродження знищених танків
  updateRespawns(): void {
    const now = this.tick * FIXED_DT;

    for (const ship of this.ships.values()) {
      if (
        !ship.destroyed ||
        now < ship.respawnAt
      ) {
        continue;
      }

      const index = [
        ...this.ships.keys(),
      ].indexOf(ship.id);

      // Повернення на початкову позицію
      ship.x = index % 2 === 0 ? 250 : 650;
      ship.y = 275;

      ship.vx = 0;
      ship.vy = 0;
      ship.angle = 0;

      // Відновлення здоров'я
      ship.hp = 100;
      ship.destroyed = false;
      ship.respawnAt = 0;

      // Захист після відродження
      ship.invulnerableUntil = now + 1;
    }
  }

  // Формування серверного snapshot
  getSnapshot(): ServerSnapshot {
    return {
      type: 'snapshot',
      tick: this.tick,
      pickups: this.pickups.map((pickup) => ({
      id: pickup.id,
      x: pickup.x,
      y: pickup.y,
      radius: pickup.radius,
      healAmount: pickup.healAmount,
    })),

      // Астероїди
      asteroids: this.asteroids.map((asteroid) => ({
        id: asteroid.id,
        x: asteroid.x,
        y: asteroid.y,
        radius: asteroid.radius,
        hp: asteroid.hp,
      })),

      // Гравці
      players: [...this.ships.values()].map(
        (ship) => ({
          id: ship.id,
          x: ship.x,
          y: ship.y,
          vx: ship.vx,
          vy: ship.vy,
          angle: ship.angle,

          hp: ship.hp,
          destroyed: ship.destroyed,

          lastProcessedSeq:
            this.lastProcessedSeq.get(ship.id) ?? 0,
        }),
      ),

      // Кулі
      bullets: this.bullets.map((bullet) => ({
        id: bullet.id,
        ownerId: bullet.ownerId,
        x: bullet.x,
        y: bullet.y,
        vx: bullet.vx,
        vy: bullet.vy,
      })),
    };
  }
}
