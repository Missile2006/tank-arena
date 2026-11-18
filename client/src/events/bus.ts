export const gameEvents = new EventTarget();
export function emitGameEvent(type: string, detail: Record<string, unknown> = {}): void {
  gameEvents.dispatchEvent(new CustomEvent(type, { detail }));
}
