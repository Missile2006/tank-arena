
export function createNetgraph() {
  const panel = document.createElement('div');

  panel.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
  width: 190px;
  padding: 8px 10px;
  border: 1px solid #35d0ff;
  border-radius: 8px;
  background: rgba(5, 12, 24, 0.92);
  color: #e5f6ff;
  font: 11px Consolas, monospace;
  line-height: 1.5;
  pointer-events: none;
  box-sizing: border-box;
`;

  document.body.appendChild(panel);

  let lastUpdate = 0;

  function update(stats) {
    const now = performance.now();

    if (now - lastUpdate < 200) {
      return;
    }

    lastUpdate = now;

    panel.innerHTML = `
      <strong style="color:#35d0ff">NETGRAPH</strong>
      <div>Protocol: ${stats.protocol}</div>
      <div>RTT: ${stats.rtt.toFixed(1)} ms</div>
      <div>Snapshot age: ${stats.snapshotAge.toFixed(0)} ms</div>
      <div>Received: ${stats.bytesPerSecond.toFixed(0)} B/s</div>
      <div>Input queue: ${stats.inputQueue}</div>
      <div>Correction: ${stats.correction.toFixed(2)} px</div>
      <div>Lag: ${stats.lag} ms</div>
      <div>Jitter: ${stats.jitter} ms</div>
      <div>Loss: ${stats.loss}%</div>
    `;
  }

  return { update };
}
