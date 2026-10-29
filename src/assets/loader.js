
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });

function isAbortError(error, signal) {
  return signal?.aborted || error?.name === 'AbortError';
}

async function fetchWithRetry(url, signal, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${url}`);
        error.status = response.status;
        throw error;
      }

      return response;
    } catch (error) {
      if (isAbortError(error, signal)) throw error;

      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (attempt >= retries) throw error;

      const delay = 300 * 2 ** attempt + Math.random() * 200;
      await sleep(delay, signal);
    }
  }
}

export async function fetchJson(url, signal) {
  const response = await fetchWithRetry(url, signal);
  return response.json();
}

export async function loadJson(url, signal) {
  return fetchJson(url, signal);
}

export async function loadImage(url, signal) {
  const response = await fetchWithRetry(url, signal);
  const blob = await response.blob();

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  const image = await createImageBitmap(blob);

  if (signal?.aborted) {
    image.close();
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  return image;
}

export async function loadAudio(url, signal, audioContext) {
  const response = await fetchWithRetry(url, signal);
  const buffer = await response.arrayBuffer();

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }

  return audioContext.decodeAudioData(buffer);
}

export async function loadAll(manifest, signal, audioContext, onProgress) {
  const items = [
    ...manifest.images.map((item) => ({ ...item, type: 'image' })),
    ...manifest.audio.map((item) => ({ ...item, type: 'audio' })),
    ...manifest.data.map((item) => ({ ...item, type: 'json' })),
  ];

  const assets = new Map();
  let completed = 0;

  onProgress?.(0, items.length);

  await Promise.all(
    items.map(async (item) => {
      let resource;

      if (item.type === 'image') {
        resource = await loadImage(item.url, signal);
      } else if (item.type === 'audio') {
        if (!audioContext) {
          throw new Error('AudioContext is required for audio assets');
        }
        resource = await loadAudio(item.url, signal, audioContext);
      } else {
        resource = await loadJson(item.url, signal);
      }

      assets.set(item.id, resource);
      completed++;
      onProgress?.(completed, items.length);
    }),
  );

  return assets;
}
