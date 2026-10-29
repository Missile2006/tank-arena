import { gameEvents } from '../events/bus.js';

export function createAudioSystem(audioContext, assets) {
  const soundIds = {
    fired: 'fire',
    hit: 'hit',
    exploded: 'explosion',
  };

  function playSound(id) {
    const buffer = assets.get(id);

    if (!buffer || audioContext.state !== 'running') {
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gain = audioContext.createGain();
    gain.gain.value = 0.3;

    source.connect(gain);
    gain.connect(audioContext.destination);

    source.start();
  }

  for (const [eventName, soundId] of Object.entries(soundIds)) {
    gameEvents.addEventListener(eventName, () => {
      playSound(soundId);
    });
  }

  return {
    resume: () => audioContext.resume(),
  };
}