// Experiment only: CPU-bound arithmetic, no access to game state or Canvas.
self.onmessage = (event: MessageEvent<{ iterations: number }>) => {
  const iterations = event.data.iterations;
  let checksum = 0;
  const started = performance.now();
  for (let i = 0; i < iterations; i++) checksum += Math.sin(i * 0.001) * Math.cos(i * 0.002);
  self.postMessage({ computeMs: performance.now() - started, checksum });
};
