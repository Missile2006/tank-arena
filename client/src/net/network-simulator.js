
export class NetworkSimulator {
  constructor() {
    const params = new URLSearchParams(window.location.search);

    this.lag = Math.max(
      0,
      Math.min(2000, Number(params.get('lag')) || 0),
    );

    this.jitter = Math.max(
      0,
      Math.min(1000, Number(params.get('jitter')) || 0),
    );

    this.loss = Math.max(
      0,
      Math.min(100, Number(params.get('loss')) || 0),
    );

    this.received = 0;
    this.dropped = 0;
  }

  receive(callback) {
    this.received++;

    // Випадково пропускаємо повідомлення
    if (Math.random() * 100 < this.loss) {
      this.dropped++;
      return;
    }

    // Випадкова зміна затримки
    const variation = (Math.random() * 2 - 1) * this.jitter;
    const delay = Math.max(0, this.lag + variation);

    if (delay === 0) {
      callback();
      return;
    }

    setTimeout(callback, delay);
  }

  getStats() {
    return {
      lag: this.lag,
      jitter: this.jitter,
      loss: this.loss,
      received: this.received,
      dropped: this.dropped,
    };
  }
}
