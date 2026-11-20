import { test, expect, type Page } from '@playwright/test';

type Player = { id: string; x: number; y: number };
type Snapshot = { type: string; players: Player[] };

async function join(page: Page, name: string): Promise<void> {
  await page.goto('/?protocol=json');
  await page.getByPlaceholder('Enter player name').fill(name);
  await expect(page.getByRole('button', { name: 'JOIN GAME' })).toBeEnabled();
  await page.getByRole('button', { name: 'JOIN GAME' }).click();
  await expect(page.locator('#gameChat')).toBeVisible();
}

function observeSnapshots(page: Page): Snapshot[] {
  const snapshots: Snapshot[] = [];
  page.on('websocket', socket => {
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return;
      try {
        const data: unknown = JSON.parse(payload);
        if (data && typeof data === 'object' && 'type' in data && data.type === 'snapshot' && 'players' in data && Array.isArray(data.players)) {
          snapshots.push(data as Snapshot);
        }
      } catch { /* ignore non-JSON frames */ }
    });
  });
  return snapshots;
}

test('two browsers share movement and chat in one room', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const a = await first.newPage();
    const b = await second.newPage();
    const aSnapshots = observeSnapshots(a);
    const bSnapshots = observeSnapshots(b);
    await join(a, 'PlayerA');
    await join(b, 'PlayerB');
    await expect.poll(() => aSnapshots.at(-1)?.players.length ?? 0).toBeGreaterThanOrEqual(2);
    await expect.poll(() => bSnapshots.at(-1)?.players.length ?? 0).toBeGreaterThanOrEqual(2);

    const baseline = aSnapshots.at(-1)!;
    const tracked = baseline.players[0]!;
    await a.locator('#gameCanvas').click();
    await a.keyboard.down('w');
    await a.waitForTimeout(650);
    await a.keyboard.up('w');

    await expect.poll(() => {
      const current = bSnapshots.at(-1)?.players.find(p => p.id === tracked.id);
      return current ? Math.hypot(current.x - tracked.x, current.y - tracked.y) : 0;
    }).toBeGreaterThan(1);

    const chat = `E2E hello ${Date.now()}`;
    await a.getByPlaceholder('Type a message...').fill(chat);
    await a.getByRole('button', { name: 'Send' }).click();
    await expect(b.locator('#gameChat')).toContainText(chat);
    await a.screenshot({ path: 'e2e-two-players.png' });
  } finally {
    await first.close();
    await second.close();
  }
});
