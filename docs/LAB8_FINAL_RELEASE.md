# Фінальний етап лабораторної №8 — GitHub Actions, GHCR, реліз

## 1. Установлення ZIP №10

Розпакувати архів **у корінь** `tank-arena-lab-04-git` із заміною `README.md`.

Цей патч **не змінює програмний код** та Dockerfile. Старий README лабораторної №7 збережено в `docs/LAB7_PERFORMANCE.md`.

## 2. Перевірка та коміт (PowerShell)

```powershell
git status
npm.cmd run typecheck
node tests/lab8-smoke.mjs
git add README.md docs/LAB7_PERFORMANCE.md docs/LAB8_FINAL_RELEASE.md
git commit -m "docs: finalize Tank Arena Lab 8 deployment and release guide"
git push
git status
```

`node tests/lab8-smoke.mjs` потребує запущеного локального контейнера (`docker compose up -d`). Якщо в `git status` є старий `tests/lab8-shutdown.mjs` або допоміжні README_PATCH, їх не додавати.

## 3. Перевірити CI

Відкрити https://github.com/Missile2006/tank-arena/actions і дочекатися **зеленого** `Tank Arena CI` для щойно створеного коміту. Якщо CI не пройшов — **не створювати тег**; надіслати лог помилки.

## 4. Перевірити, чи існує тег

```powershell
git fetch --tags
git tag -l v1.0.0
```

Якщо команда вивела `v1.0.0`, **не повторювати** створення тегу; перевірити наявний реліз.

## 5. Створити тег після успішного CI

```powershell
git tag -a v1.0.0 -m "Tank Arena Lab 8 release"
git push origin v1.0.0
```

Це запустить `.github/workflows/release.yml` (тег `v*`). Workflow перевіряє типи, збірку, Docker readiness, git SHA та smoke-тести, потім публікує GHCR образ.

## 6. Перевірити GHCR

Відкрити GitHub → Actions → **Release Docker image to GHCR**. Дочекатися зеленого результату. Після цього перевірити GitHub → Packages. Очікуваний образ:

`ghcr.io/missile2006/tank-arena:v1.0.0`

Це **очікуване ім'я**, а не твердження, що пакет уже існує. Якщо пакет приватний, для публічного завантаження потрібно змінити його visibility в GitHub Packages.

Перевірка образу (після успішної публікації та за наявності доступу):

```powershell
docker pull ghcr.io/missile2006/tank-arena:v1.0.0
docker image inspect ghcr.io/missile2006/tank-arena:v1.0.0 --format '{{.Size}}'
```

## 7. GitHub Release (не плутати з Docker package)

GitHub → Releases → **Draft a new release** → Choose tag `v1.0.0` → заголовок `Tank Arena v1.0.0 — Lab 8` → Publish release. Рекомендований текст:

> Перша публічна версія Tank Arena. Node.js/TypeScript, Canvas і WebSocket; Docker, Render Free HTTPS/WSS, health/readiness/metrics, перевірка Origin, обмеження кімнат, CI та автоматична публікація GHCR. Локально перевірено 8/8 smoke і 4/4 Docker shutdown; вручну перевірено двох гравців із різних мереж. Гра: https://tank-arena-missile2006.onrender.com. Обмеження: безкоштовний Render може призупиняти сервіс.

## 8. Скриншоти для звіту

Зберегти: (1) Render Free / Live / HTTPS URL, (2) гра у браузері з Netgraph, (3) `/health` і `/ready`, (4) два гравці, (5) Docker 8/8 і shutdown 4/4, (6) зелений release workflow, (7) GHCR package `v1.0.0`.

Не стверджувати, що GHCR опублікований, доки GitHub Actions не завершиться успішно.
