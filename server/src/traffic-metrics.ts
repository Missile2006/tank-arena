// Counters for application WebSocket messages (payload bytes, excluding framing).
let receivedMessages = 0;
let sentMessages = 0;
let receivedBytes = 0;
let sentBytes = 0;
let previousSample = { time: performance.now(), receivedMessages: 0, sentMessages: 0, receivedBytes: 0, sentBytes: 0 };

export function recordInbound(bytes: number): void {
  receivedMessages++;
  receivedBytes += bytes;
}
export function recordOutbound(bytes: number): void {
  sentMessages++;
  sentBytes += bytes;
}
export function sampleTrafficMetrics() {
  const now = performance.now();
  const seconds = Math.max((now - previousSample.time) / 1000, 0.001);
  const result = {
    messagesPerSecond: (receivedMessages + sentMessages - previousSample.receivedMessages - previousSample.sentMessages) / seconds,
    bytesPerSecond: (receivedBytes + sentBytes - previousSample.receivedBytes - previousSample.sentBytes) / seconds,
    receivedMessages, sentMessages, receivedBytes, sentBytes,
  };
  previousSample = { time: now, receivedMessages, sentMessages, receivedBytes, sentBytes };
  return result;
}
