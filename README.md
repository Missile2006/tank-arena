# Tank Arena — багатокористувацька браузерна гра

[**Грати онлайн (HTTPS)**](https://tank-arena-missile2006.onrender.com) · [**GitHub**](https://github.com/Missile2006/tank-arena) · [**GitHub Actions**](https://github.com/Missile2006/tank-arena/actions)

**Tank Arena** — навчальний проєкт на TypeScript: клієнт на HTML Canvas/Vite, сервер на Node.js та обмін станом гри через WebSocket. Проєкт створено в межах серії лабораторних робіт із JavaScript. Публічне розгортання працює на Render Free через HTTPS/WSS.

> Безкоштовний Render може присипляти сервіс за відсутності активності; перше завантаження після паузи може тривати понад 50 секунд. Публічний URL не гарантує цілодобову доступність.

## Архітектура

```text
Браузер A (Canvas / Vite) ─┐
                           ├── HTTPS / WSS ── Render (Docker)
Браузер B (Canvas / Vite) ─┘                     │
                                                ├── Node.js / WebSocket
                                                ├── Room Manager / Game Simulation
                                                ├── /health, /ready, /metrics
                                                └── Pino / журнал подій
```

- `client/` — інтерфейс, Canvas, введення гравця, чат і мережеві показники.
- `server/` — HTTP/WebSocket, кімнати, авторитетна серверна симуляція, ліміти підключень, метрики та журналювання.
- `shared/` — спільні типи й контракти.
- `tests/` — smoke-тести, тести лімітів і Docker graceful shutdown.
- `.github/workflows/` — CI та публікація Docker-образу в GHCR.
- `render.yaml` — конфігурація публічного сервісу Render Free.

## Запуск локально (Windows PowerShell)

Вимоги: Node.js 24, npm, Git; Docker Desktop — для контейнерного запуску.

```powershell
npm.cmd ci
npm.cmd run dev:server
```

В іншому терміналі:

```powershell
npm.cmd run dev:client
```

Відкрийте URL, який виведе Vite (зазвичай `http://localhost:5173`).

### Production Docker

```powershell
docker compose up -d --build
docker compose ps
node tests/lab8-smoke.mjs
```

Після запуску локальна гра доступна на `http://localhost:3000`.

## Перевірки

```powershell
npm.cmd run typecheck
npm.cmd exec -- vitest run
npm.cmd run build -w tank-arena-client
npm.cmd run build -w tank-arena-server
npm.cmd exec -- playwright test
node tests/lab8-smoke.mjs
npm.cmd exec -- tsx tests/lab8-room-limits.ts
```

Для Playwright необхідно мати зібраний сервер і встановлені браузери (`npm.cmd exec -- playwright install chromium`). Для smoke-тесту необхідний запущений Docker-контейнер із дозволеним локальним Origin.

**Тест коректного завершення (зупиняє та перезапускає контейнер):**

```powershell
node tests/lab8-docker-shutdown.mjs
```

### Підтверджені результати лабораторної №8

| Перевірка | Результат |
|---|---|
| TypeScript typecheck | Успішно, 21.11.2026 |
| Docker build і запуск | Успішно, 21.11.2026 |
| Smoke-тести | **8/8 PASS** |
| Docker shutdown / активний WebSocket | **4/4 PASS**; повідомлення `shutdown`, close code `1001`, exit `0` |
| Повторний запуск Docker | `healthy` |
| Публічний HTTPS, `/health`, `/ready` | Успішно |
| Два гравці з різних мереж | Рух і чат перевірено вручну, успішно |
| GitHub Actions CI | Успішно перевірено на попередніх комітах; стан після фінального коміту потрібно перевірити |
| GHCR і тег `v1.0.0` | **Очікують публікації та перевірки** |

У попередній локальній перевірці Docker-образ мав розмір приблизно **180,65 MiB**. Це не є вимірюванням образу після майбутнього GHCR-релізу.

## Діагностика

- `GET /health` — стан сервера, uptime, git SHA.
- `GET /ready` — готовність до обслуговування запитів.
- `GET /metrics` — технічні метрики.
- WebSocket `/ws` — передавання ігрових повідомлень. Для HTTPS-сторінки використовується `wss://`.
- Сервер обмежує Origin, кількість з'єднань з IP, кількість кімнат і гравців у кімнаті.

Публічний `/metrics` може розкривати службову телеметрію. Для реального production-сервісу доцільно обмежити доступ до цього endpoint.

## Розгортання

Render використовує `render.yaml`, `Dockerfile`, гілку `lab-08-development` і план `free`. Деталі: [docs/RENDER_FREE_DEPLOY.md](docs/RENDER_FREE_DEPLOY.md).

GHCR-реліз виконується через `.github/workflows/release.yml` після push тегу `v*`. Покрокова перевірка: [docs/LAB8_FINAL_RELEASE.md](docs/LAB8_FINAL_RELEASE.md).

## Обмеження

- Безкоштовний Render може призупиняти процес; кімнати та підключення під час сну/перезапуску не зберігаються.
- Журнали всередині контейнера не є довготривалим сховищем на безкоштовному хостингу.
- Ліміт гравців у кімнаті — 4; масштабування між кількома інстансами не реалізовано.
- Мережева затримка залежить від місця розташування гравців і сервера.

## Попередні лабораторні

Результати профілювання V8, GC, Web Worker, навантажувальних тестів та 148 модульних тестів із лабораторної №7 збережено без змін у [docs/LAB7_PERFORMANCE.md](docs/LAB7_PERFORMANCE.md).
