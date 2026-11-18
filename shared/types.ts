// Branded identifiers prevent accidental interchange of numeric/string IDs.
export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type PlayerId = Brand<string, 'PlayerId'>;
export type Tick = Brand<number, 'Tick'>;
export type InputSeq = Brand<number, 'InputSeq'>;

export interface Vector2 { readonly x: number; readonly y: number }
export interface ShipState extends Vector2 {
  id: PlayerId;
  vx: number;
  vy: number;
  angle: number;
}
export interface PlayerSnapshot extends ShipState {
  readonly kind: 'player';
  readonly hp: number;
  readonly destroyed: boolean;
  readonly lastProcessedSeq: InputSeq;
}
export interface BulletSnapshot extends Vector2 {
  readonly kind: 'bullet';
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly vx: number;
  readonly vy: number;
}
export interface AsteroidSnapshot extends Vector2 {
  readonly kind: 'asteroid';
  readonly id: number;
  readonly radius: number;
  readonly hp: number;
}
export type SnapshotEntity = PlayerSnapshot | BulletSnapshot | AsteroidSnapshot;
export interface Snapshot {
  readonly type: 'snapshot';
  readonly tick: Tick;
  readonly players: readonly PlayerSnapshot[];
  readonly bullets: readonly BulletSnapshot[];
  readonly asteroids: readonly AsteroidSnapshot[];
}
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
export function entityKind(entity: SnapshotEntity): string {
  switch (entity.kind) {
    case 'player': return 'player';
    case 'bullet': return 'bullet';
    case 'asteroid': return 'asteroid';
    default: return assertNever(entity);
  }
}
