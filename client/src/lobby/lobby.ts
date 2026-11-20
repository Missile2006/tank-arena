import type { LobbyRoom } from './lobby-ui.ts';

import { fetchJson } from '../assets/loader';

export class Lobby extends EventTarget {
  rooms: LobbyRoom[] = [];
  refreshTimer: ReturnType<typeof setInterval> | null = null;
  requestController: AbortController | null = null;
  visible = false;

  constructor() {
    super();
  }

  // Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ СЃРїРёСЃРєСѓ РєС–РјРЅР°С‚ С–Р· Node.js-СЃРµСЂРІРµСЂР°
  async loadRooms(): Promise<void> {
    // РЎРєР°СЃРѕРІСѓС”РјРѕ РїРѕРїРµСЂРµРґРЅС–Р№ Р·Р°РїРёС‚
    this.requestController?.abort();

    const controller = new AbortController();
    this.requestController = controller;

    // РћР±РјРµР¶СѓС”РјРѕ С‡Р°СЃ РѕС‡С–РєСѓРІР°РЅРЅСЏ РґРѕ 5 СЃРµРєСѓРЅРґ
    const timeoutSignal = AbortSignal.timeout(5000);

    const signal = AbortSignal.any([
      controller.signal,
      timeoutSignal,
    ]);

    try {
      // РћС‚СЂРёРјСѓС”РјРѕ РєС–РјРЅР°С‚Рё С‡РµСЂРµР· Vite proxy
      const data = await fetchJson('/api/rooms', signal);

      // РќРµ РѕРЅРѕРІР»СЋС”РјРѕ РїСЂРёС…РѕРІР°РЅРµ Р»РѕР±С–
      if (!this.visible || controller.signal.aborted) {
        return;
      }

      // Node.js РїРѕРІРµСЂС‚Р°С” РјР°СЃРёРІ РєС–РјРЅР°С‚ РЅР°РїСЂСЏРјСѓ
      if (!Array.isArray(data)) {
        throw new Error(
          'РЎРµСЂРІРµСЂ РїРѕРІРµСЂРЅСѓРІ РЅРµРїСЂР°РІРёР»СЊРЅРёР№ СЃРїРёСЃРѕРє РєС–РјРЅР°С‚',
        );
      }

      this.rooms = data as LobbyRoom[];

      // РџРѕРІС–РґРѕРјР»СЏС”РјРѕ С–РЅС‚РµСЂС„РµР№СЃ РїСЂРѕ РѕРЅРѕРІР»РµРЅРЅСЏ
      this.dispatchEvent(
        new CustomEvent('roomsUpdated', {
          detail: {
            rooms: this.rooms,
          },
        }),
      );
    } catch (error) {
      if (controller.signal.aborted || !this.visible) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent('error', {
          detail: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    } finally {
      if (this.requestController === controller) {
        this.requestController = null;
      }
    }
  }

  // Р’С–РґРѕР±СЂР°Р¶РµРЅРЅСЏ Р»РѕР±С–
  show(): void {
    if (this.visible) {
      return;
    }

    this.visible = true;

    // РћРґСЂР°Р·Сѓ РѕС‚СЂРёРјСѓС”РјРѕ РєС–РјРЅР°С‚Рё
    this.loadRooms();

    // РћРЅРѕРІР»СЋС”РјРѕ СЃРїРёСЃРѕРє РєРѕР¶РЅС– 10 СЃРµРєСѓРЅРґ
    this.refreshTimer = setInterval(() => {
      this.loadRooms();
    }, 10000);
  }

  // РџСЂРёС…РѕРІСѓРІР°РЅРЅСЏ Р»РѕР±С–
  hide(): void {
    this.visible = false;

    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    // РЎРєР°СЃРѕРІСѓС”РјРѕ РЅРµР·Р°РІРµСЂС€РµРЅРёР№ Р·Р°РїРёС‚
    this.requestController?.abort();
    this.requestController = null;
  }

  // Р’РёР±С–СЂ РєС–РјРЅР°С‚Рё С‚Р° РІС…С–Рґ Сѓ РіСЂСѓ
  join(playerName: string, roomId: string): void {
    const name = playerName.trim();

    if (!name) {
      throw new Error("Р’РІРµРґС–С‚СЊ С–Рј'СЏ РіСЂР°РІС†СЏ");
    }

    if (name.length > 30) {
      throw new Error(
        "Р†Рј'СЏ РіСЂР°РІС†СЏ РЅРµ РїРѕРІРёРЅРЅРѕ РїРµСЂРµРІРёС‰СѓРІР°С‚Рё 30 СЃРёРјРІРѕР»С–РІ",
      );
    }

    // РЁСѓРєР°С”РјРѕ РІРёР±СЂР°РЅСѓ РєС–РјРЅР°С‚Сѓ
    const room = this.rooms.find(
      (item) => String(item.id) === String(roomId),
    );

    if (!room) {
      throw new Error('Р’РёР±РµСЂС–С‚СЊ РґРѕСЃС‚СѓРїРЅСѓ РєС–РјРЅР°С‚Сѓ');
    }

    if (room.players >= room.maxPlayers) {
      throw new Error('Р¦СЏ РєС–РјРЅР°С‚Р° РІР¶Рµ Р·Р°РїРѕРІРЅРµРЅР°');
    }

    // РџСЂРёС…РѕРІСѓС”РјРѕ Р»РѕР±С– РїС–СЃР»СЏ РІРёР±РѕСЂСѓ РєС–РјРЅР°С‚Рё
    this.hide();

    // РџРµСЂРµРґР°С”РјРѕ С–РЅС„РѕСЂРјР°С†С–СЋ РіРѕР»РѕРІРЅРѕРјСѓ РјРѕРґСѓР»СЋ РіСЂРё
    this.dispatchEvent(
      new CustomEvent('joined', {
        detail: {
          playerName: name,
          room,
        },
      }),
    );
  }
}

