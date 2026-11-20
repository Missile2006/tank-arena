export interface WorkerBenchmarkResult {
  mainThreadMs: number;
  workerComputeMs: number;
  workerRoundTripMs: number;
  checksumDifference: number;
}

function compute(iterations: number): number {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) checksum += Math.sin(i * 0.001) * Math.cos(i * 0.002);
  return checksum;
}

// Run from DevTools: import('/src/experiments/worker-benchmark.ts').then(m => m.runWorkerBenchmark())
// Measures an isolated CPU task, NOT the actual game's frame time.
export async function runWorkerBenchmark(iterations = 2_000_000): Promise<WorkerBenchmarkResult> {
  const mainStart = performance.now();
  const mainChecksum = compute(iterations);
  const mainThreadMs = performance.now() - mainStart;

  const worker = new Worker(new URL('./worker-benchmark.worker.ts', import.meta.url), { type: 'module' });
  const workerStart = performance.now();
  try {
    const response = await new Promise<{ computeMs: number; checksum: number }>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ computeMs: number; checksum: number }>) => resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage({ iterations });
    });
    const result = {
      mainThreadMs,
      workerComputeMs: response.computeMs,
      workerRoundTripMs: performance.now() - workerStart,
      checksumDifference: Math.abs(mainChecksum - response.checksum),
    };
    console.table(result);
    return result;
  } finally {
    worker.terminate();
  }
}
