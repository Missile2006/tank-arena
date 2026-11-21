# Tank Arena — безкоштовне розгортання на Render

## Підготовка

1. Розпакуй ZIP у корінь проєкту. Не змінюй Dockerfile та compose.yaml.
2. Перевір локально: `npm.cmd run typecheck`, `docker compose up -d --build`, `node tests/lab8-smoke.mjs`.
3. Додай файли до Git:
   ```powershell
   git add render.yaml server/src/config.ts docs/RENDER_FREE_DEPLOY.md
   git commit -m "deploy: configure free Render HTTPS and WSS"
   git push
   ```
4. Перевір зелені результати CI у GitHub Actions.

## Створення безкоштовного сервісу

1. Відкрий https://dashboard.render.com/ і ввійди через GitHub.
2. Вибери **New > Blueprint** та підключи `Missile2006/tank-arena`.
3. Перевір, що Blueprint бере `render.yaml` із гілки `lab-08-development` (якщо Render пропонує вибір гілки).
4. Перевір налаштування **Free** перед підтвердженням. Не обирай платний план.
5. Підтверди створення сервісу та дочекайся `Live`. Перший Docker build може тривати декілька хвилин.
6. Скопіюй **реальну** адресу сервісу з Render Dashboard (наприклад, `https://tank-arena-missile2006.onrender.com`; це приклад, не гарантована адреса).

## Перевірка

В PowerShell підстав реальну адресу (без кінцевого `/`):

```powershell
$base = 'https://ВСТАВ_РЕАЛЬНУ_АДРЕСУ.onrender.com'
Invoke-RestMethod "$base/health"
Invoke-RestMethod "$base/ready"
Invoke-RestMethod "$base/metrics"
Start-Process $base
```

Потім відкрий цю саму адресу на двох пристроях з **різних мереж** (наприклад, ПК через Wi-Fi і телефон через мобільний інтернет). Обери однакову кімнату, приєднайся під різними іменами, перевір рух і чат. Браузер використовує `wss://` автоматично, оскільки сторінка завантажена через HTTPS.

## Чому WebSocket дозволений

`server/src/config.ts` додає до дозволених Origin точну адресу `RENDER_EXTERNAL_URL`, яку Render автоматично задає для свого сервісу. Всі інші невідомі Origin залишаються забороненими. Якщо пізніше використовуватимеш власний домен, додай його HTTPS-Origin до `ALLOWED_ORIGINS` у Render Environment.

## Обмеження безкоштовного плану

- Render присипляє безкоштовний сервіс після 15 хвилин без вхідного HTTP-трафіку **та** WebSocket-повідомлень. Перший запит після сну може чекати приблизно хвилину.
- Файлова система тимчасова: локальні `events.ndjson` можуть зникнути при перезапуску/новому деплої. Для захисту можна переглядати логи в Render Dashboard; це не постійне сховище.
- 750 безкоштовних instance-hours на workspace щомісяця; діють інші ліміти трафіку/збірок. Перевір план перед підтвердженням.
- Не створюй тег `v1.0.0`, доки публічна гра не перевірена.

## Якщо Blueprint недоступний

Створи **New > Web Service**, підключи той самий репозиторій, вибери `lab-08-development`, runtime **Docker**, Dockerfile `./Dockerfile`, план **Free**, health check `/ready`. Додай `HOST=0.0.0.0`, `PORT=3000`, `LOG_DIR=/app/server/logs`, `NODE_ENV=production`. `RENDER_EXTERNAL_URL` Render встановлює автоматично.
