# Factora — RWA Receivables (Decentrathon)

Монорепозиторий платформы **токенизации дебиторской задолженности (RWA receivables)** на **Solana**: on-chain логика (Anchor), REST API (NestJS), индексатор транзакций, веб-клиент (Next.js). В корне также лежит PDF с техническим заданием (`rwa_receivables_technical_spec.pdf`).

---

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `backend/` | Рабочее пространство Anchor + Node-скрипты, тесты, демо-сидеры |
| `backend/programs/receivables_program` | Основная программа: активы, фандинг, выплаты, whitelist, клеймы |
| `backend/programs/transfer_hook_program` | Token-2022 transfer hook (ограничения переводов токенов актива) |
| `backend/services/api` | **NestJS API** — доменные модули, Prisma, загрузка документов, Solana |
| `backend/services/indexer` | **Индексатор** — опрос RPC, разбор логов, синхронизация с PostgreSQL |
| `backend/packages/shared-types` | Общие TypeScript-типы/DTO для скриптов |
| `backend/docker/docker-compose.yml` | **PostgreSQL 16**, Redis, MinIO (локальное S3-совместимое хранилище) |
| `backend/migrations/` | Скрипты проверки деплоя/инициализации Anchor |
| `backend/scripts/seed-demo/` | Демо: кошельки, allowlist, актив, сценарий «сквозного» прогона |
| `backend/tests/` | Anchor-тесты (`node --test`) и интеграционные тесты API |
| `frontend/` | **Next.js 16** (App Router) — marketplace, портфель, роли, кошельки |
| `apps/` | Служебный/временный артефакт (кэш `.next` не коммитится) |

---

## Архитектура (кратко)

```mermaid
flowchart LR
  subgraph client [Клиент]
    FE[Next.js frontend]
  end
  subgraph backend [Сервер]
    API[NestJS API :3001]
    IDX[Indexer]
  end
  subgraph chain [Solana devnet]
    RP[receivables_program]
    TH[transfer_hook_program]
  end
  subgraph data [Данные]
    PG[(PostgreSQL)]
    S3[(MinIO / memory)]
    RD[(Redis)]
  end
  FE -->|HTTPS REST /api| API
  FE -->|RPC + tx| chain
  API --> PG
  API --> S3
  API --> RD
  IDX -->|poll signatures| chain
  IDX --> PG
```

- **Фронтенд** ходит в бэкенд по `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:3001`); пути клиента вида `/api/...` склеиваются с этим базовым URL (глобальный префикс Nest — `api`, итоговые маршруты совпадают с ожиданиями клиента).
- **API** хранит пользователей, активы, документы, whitelist, инвестиционные чеки, снапшоты клеймов, аудит-активность; валидирует роли по кошелькам из env; готовит транзакции/проверки для Solana.
- **Индексатор** периодически (`INDEXER_POLL_INTERVAL_MS`) подтягивает подписи после сохранённого слота, парсит события программы и обновляет статусы активов и курсор в таблице `indexer_cursors`.
- **On-chain**: жизненный цикл актива зафиксирован в `docs/architecture/domain-v1.md` (статусы `Created` → … → `Closed` / `Cancelled`).

---

## Стек технологий

| Слой | Технологии |
|------|------------|
| On-chain | Rust, Anchor, Solana Devnet, Token-2022 |
| API | NestJS 11, Prisma 5, PostgreSQL, class-validator, Joi (env), AWS SDK (S3-совместимый бэкенд) |
| Индексатор | TypeScript, `@solana/web3.js`, Prisma |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, `@solana/wallet-adapter`, TanStack Query, Zustand, Axios |
| Инфраструктура | Docker Compose: Postgres (порт **15432** на хосте), Redis **6379**, MinIO **9000/9001** |

---

## Предварительные требования

- **Node.js** (LTS) и npm  
- **Rust** + **Anchor** — для сборки и деплоя программ  
- **Docker** — для Postgres / Redis / MinIO  
- Кошелёк Solana CLI (опционально) для деплоя на devnet  

---

## Быстрый старт (локально)

### 1. Инфраструктура

```bash
cd backend
docker compose -f docker/docker-compose.yml up -d
```

### 2. Переменные окружения

Скопируйте примеры и подставьте **реальные** адреса минтов и program id после деплоя:

```bash
cp backend/.env.example backend/.env
cp backend/services/api/.env.example backend/services/api/.env
cp backend/services/indexer/.env.example backend/services/indexer/.env
cp frontend/.env.example frontend/.env.local
```

Важно:

- `DATABASE_URL` в **API** должен совпадать с поднятым Postgres (в примере API: `postgresql://rwa:rwa@127.0.0.1:15432/rwa`).
- В **indexer** `.env.example` может отличаться — для локальной разработки используйте тот же `DATABASE_URL`, что и у API.
- В корневом `backend/.env` и в `services/api/.env` должны быть согласованы `USDC_MINT`, `RECEIVABLES_PROGRAM_ID`, `TRANSFER_HOOK_PROGRAM_ID` и кошельки ролей.
- Обновите `backend/Anchor.toml` секцию `[programs.devnet]` под задеплоенные ID.

### 3. Миграции БД и Prisma

```bash
cd backend/services/api
npm install
npm run prisma:generate
npm run db:migrate
```

### 4. Запуск API

```bash
cd backend/services/api
npm run dev
```

API слушает порт **3001** (или `PORT` из env). Префикс маршрутов: `/api`.

### 5. Запуск индексатора (отдельный терминал)

```bash
cd backend/services/indexer
npm install
npm run dev
```

### 6. Запуск фронтенда

```bash
cd frontend
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). Убедитесь, что `NEXT_PUBLIC_API_URL` указывает на работающий API (по умолчанию `http://localhost:3001`).

---

## Основные порты

| Сервис | Порт |
|--------|------|
| Next.js (dev) | 3000 |
| NestJS API | 3001 |
| PostgreSQL (из Docker) | **15432** → 5432 в контейнере |
| Redis | 6379 |
| MinIO API / консоль | 9000 / 9001 |

---

## Скрипты и тесты (backend root)

Из каталога `backend/`:

| Команда | Назначение |
|---------|------------|
| `npm run anchor:test` | Тесты Anchor (Node test runner) |
| `npm run integration:test` | Интеграционные тесты |
| `npm run day6:test` | Оба набора подряд |
| `npm run demo:seed-wallets` и др. | Демо-сценарии (см. `scripts/seed-demo/`) |

API:

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Режим разработки Nest |
| `npm run db:migrate` | Применить миграции Prisma |
| `npm run db:seed` | Сид БД (если настроен) |
| `npm test` | Тесты сервисного слоя |

---

## Маршруты фронтенда (роли)

| Маршрут | Назначение |
|---------|------------|
| `/` | Лендинг / вход |
| `/marketplace` | Каталог активов в фандинге / профинансированных |
| `/asset/[id]` | Карточка актива, инвестирование |
| `/submit` | Подача актива (эмитент) |
| `/portfolio` | Портфель инвестора |
| `/verifier` | Очередь на верификацию |
| `/admin` | Админ: открытие/закрытие фандинга, учёт погашения |

Роль определяется по кошельку через API (`/api/users/:wallet`).

---

## Доменная модель

Каноничное описание статусов активов, ролей и переходов — в  
`backend/docs/architecture/domain-v1.md`  
и `backend/docs/architecture/bootstrap-manifest.md`.

---

## Безопасность

- Не коммитьте `.env`, `.env.local` и ключи кошельков.
- В репозитории только `.env.example` с плейсхолдерами.
- Для продакшена настройте отдельные секреты, CORS и хранилище документов (MinIO / S3 / Pinata — см. `PINATA_JWT` и `STORAGE_PROVIDER` в API).

---

## Документация внутри проекта

- `backend/README.md` — краткий runbook Day 6 (пути относительно `backend/`).
- `frontend/README.md` — детали UI-стека и интеграции (часть путей в нём исторически указывает на `apps/web`; актуальный код — в каталоге `frontend/`).

---

## Лицензия и вклад

Уточните лицензию при публикации. Pull request’ы и issues — по стандартному процессу GitHub.
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
