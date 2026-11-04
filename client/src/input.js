export function createInput() {
  const down = new Set();
  const pressed = new Set();

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        ' ',
      ].includes(key)
    ) {
      event.preventDefault();
    }

    if (!down.has(key)) {
      pressed.add(key);
    }

    down.add(key);
  }

  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    down.delete(key);
  }

  function onBlur() {
    down.clear();
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    isDown(key) {
      return down.has(key.toLowerCase());
    },

    justPressed(key) {
      return pressed.has(key.toLowerCase());
    },

    endStep() {
      pressed.clear();
    },

    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      down.clear();
      pressed.clear();
    },
  };
}
