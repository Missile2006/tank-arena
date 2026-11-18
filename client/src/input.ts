export interface InputController {
  isDown(key: string): boolean;
  justPressed(key: string): boolean;
  endStep(): void;
  destroy(): void;
}

export function createInput(): InputController {
  const down = new Set<string>();
  const pressed = new Set<string>();
  function onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (!down.has(key)) pressed.add(key);
    down.add(key);
  }
  function onKeyUp(event: KeyboardEvent): void { down.delete(event.key.toLowerCase()); }
  function onBlur(): void { down.clear(); pressed.clear(); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return {
    isDown(key: string): boolean { return down.has(key.toLowerCase()); },
    justPressed(key: string): boolean { return pressed.has(key.toLowerCase()); },
    endStep(): void { pressed.clear(); },
    destroy(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      down.clear(); pressed.clear();
    },
  };
}
