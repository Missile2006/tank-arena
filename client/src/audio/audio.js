
import { gameEvents } from '../events/bus.ts';

export function createAudioSystem(audioContext, assets) {
  const soundIds = {
    fired: 'fire',
    hit: 'hit',
    exploded: 'explosion',
  };

  async function playSound(id) {
    const buffer = assets.get(id);

    if (!buffer) {
      console.warn(`Sound not found: ${id}`);
      return;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (error) {
        console.warn('Audio resume failed:', error);
        return;
      }
    }

    if (audioContext.state !== 'running') {
      console.warn('AudioContext state:', audioContext.state);
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
      void playSound(soundId);
    });
  }

  return {
    resume: () => audioContext.resume(),
  };
}
