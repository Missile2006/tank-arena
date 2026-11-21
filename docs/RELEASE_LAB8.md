# Лабораторна №8 — реліз через GitHub Actions / GHCR

## Що робить автоматизація

При `git push` тегу `v*` workflow `.github/workflows/release.yml` перевіряє TypeScript, збирає клієнт і сервер, запускає Docker-контейнер, перевіряє `/ready`, звіряє `gitSha` у `/health` з SHA коміту та виконує 8 smoke-тестів. Лише після успішних перевірок публікує образ у GHCR.

Теги образу: `ghcr.io/<owner>/<repo>:v1.0.0` і `ghcr.io/<owner>/<repo>:sha-<короткий_SHA>`.

Публікація використовує `GITHUB_TOKEN` і дозвіл `packages: write`; окремий PAT зазвичай не потрібен. Якщо пакет приватний, для його завантаження на зовнішній сервер потрібна авторизація. Видимість пакета можна налаштувати на GitHub у налаштуваннях Packages.

## Локальна перевірка (PowerShell)

```powershell
npm.cmd run typecheck
docker compose build --no-cache
docker compose up -d
docker compose ps
node tests/lab8-smoke.mjs
Invoke-RestMethod http://localhost:3000/health
```

`gitSha: local` під час локального `docker compose build` — нормально: SHA задається CI через `--build-arg GIT_SHA`.

## Коміт та реліз

Переконайтеся, що файл `tests/lab8-smoke.mjs` із ZIP №2 існує й потрапить у коміт. Команди:

```powershell
git status
git add Dockerfile .github/workflows/release.yml docs/RELEASE_LAB8.md tests/lab8-smoke.mjs
git commit -m "ci: publish tested Lab 8 image to GHCR"
git push
```

**Створюйте тег лише після успішного CI** (Actions → Tank Arena CI). Потім:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Перевірте GitHub → Actions → `Release Docker image to GHCR`, а потім сторінку Packages репозиторію. Якщо тег `v1.0.0` уже існує, не створюйте його повторно — повідомте, і виберемо наступну версію.

## HTTPS/WSS — наступний крок, ще НЕ налаштований

Публікація образу у GHCR не робить гру доступною з інтернету. Для цього потрібні хостинг/сервер, домен або видана платформою HTTPS-адреса, TLS та WebSocket proxy. У production потрібно додати точний `https://...` Origin у `ALLOWED_ORIGINS`; для WebSocket використовується `wss://...`. Не встановлюйте `ALLOWED_ORIGINS=*`, бо сервер перевіряє дозволені Origin.

Для майбутнього розгортання також потрібні перевірки двох гравців із різних мереж, доступності `/health`, `/ready`, `/metrics`, shutdown та журналів.

## Відновлення

`Dockerfile.backup` у ZIP №5 — незмінена успішна версія Dockerfile із ZIP №4. Якщо виникне проблема, скопіюйте його в `Dockerfile` та перебудуйте контейнер.
