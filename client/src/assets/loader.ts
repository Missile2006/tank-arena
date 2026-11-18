
export interface AssetItem {
  id: string;
  url: string;
}

export interface AssetManifest {
  images: AssetItem[];
  audio: AssetItem[];
  data: AssetItem[];
}

export type AssetResource = ImageBitmap | AudioBuffer | unknown;

export type AssetMap = Map<string, AssetResource>;

export type ProgressCallback = (
  completed: number,
  total: number,
) => void;

type AssetType = 'image' | 'audio' | 'json';

interface TypedAssetItem extends AssetItem {
  type: AssetType;
}

interface HttpError extends Error {
  status: number;
}

function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      reject(abortReason(signal));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });

function isAbortError(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function getHttpStatus(error: unknown): number | undefined {
  if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }

  return undefined;
}

async function fetchWithRetry(
  url: string,
  signal?: AbortSignal,
  retries = 3,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal });

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${url}`,
        ) as HttpError;

        error.status = response.status;
        throw error;
      }

      return response;
    } catch (error: unknown) {
      if (isAbortError(error, signal)) {
        throw error;
      }

      const status = getHttpStatus(error);

      if (status !== undefined && status >= 400 && status < 500) {
        throw error;
      }

      if (attempt >= retries) {
        throw error;
      }

      const delay = 300 * 2 ** attempt + Math.random() * 200;
      await sleep(delay, signal);
    }
  }
}

export async function fetchJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetchWithRetry(url, signal);
  return response.json() as Promise<unknown>;
}

export async function loadJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return fetchJson(url, signal);
}

export async function loadImage(
  url: string,
  signal?: AbortSignal,
): Promise<ImageBitmap> {
  const response = await fetchWithRetry(url, signal);
  const blob = await response.blob();

  if (signal?.aborted) {
    throw abortReason(signal);
  }

  const image = await createImageBitmap(blob);

  if (signal?.aborted) {
    image.close();
    throw abortReason(signal);
  }

  return image;
}

export async function loadAudio(
  url: string,
  signal: AbortSignal | undefined,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  const response = await fetchWithRetry(url, signal);
  const buffer = await response.arrayBuffer();

  if (signal?.aborted) {
    throw abortReason(signal);
  }

  return audioContext.decodeAudioData(buffer);
}

export async function loadAll(
  manifest: AssetManifest,
  signal?: AbortSignal,
  audioContext?: AudioContext,
  onProgress?: ProgressCallback,
): Promise<AssetMap> {
  const items: TypedAssetItem[] = [
    ...manifest.images.map((item) => ({
      ...item,
      type: 'image' as const,
    })),
    ...manifest.audio.map((item) => ({
      ...item,
      type: 'audio' as const,
    })),
    ...manifest.data.map((item) => ({
      ...item,
      type: 'json' as const,
    })),
  ];

  const assets: AssetMap = new Map();
  let completed = 0;

  onProgress?.(0, items.length);

  await Promise.all(
    items.map(async (item) => {
      let resource: AssetResource;

      switch (item.type) {
        case 'image':
          resource = await loadImage(item.url, signal);
          break;

        case 'audio':
          if (!audioContext) {
            throw new Error(
              'AudioContext is required for audio assets',
            );
          }
          resource = await loadAudio(
            item.url,
            signal,
            audioContext,
          );
          break;

        case 'json':
          resource = await loadJson(item.url, signal);
          break;
      }

      assets.set(item.id, resource);
      completed++;
      onProgress?.(completed, items.length);
    }),
  );

  return assets;
}
