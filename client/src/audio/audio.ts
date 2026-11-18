
import { gameEvents } from '../events/bus.js';

export interface AudioSystem {
  resume(): Promise<void>;
}

export function createAudioSystem(
  audioContext: AudioContext,
  assets: ReadonlyMap<string, unknown>,
): AudioSystem {
  const soundIds = {
    fired: 'fire',
    hit: 'hit',
    exploded: 'explosion',
  } as const;

  async function playSound(id: string): Promise<void> {
    const buffer = assets.get(id);

    if (!(buffer instanceof AudioBuffer)) {
      console.warn(`Sound not found or invalid: ${id}`);
      return;
    }

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (error: unknown) {
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
