# RWA API

## Quick Start

1. Start infra from repo root:
   - `cd ../../docker`
   - `docker compose up -d`
2. Go to API service:
   - `cd ../services/api`
3. Install dependencies:
   - `npm install`
4. Create local env:
   - `copy .env.example .env`
5. Generate Prisma client:
   - `npm run prisma:generate`
6. Apply DB migrations:
   - `npm run db:migrate`
7. Seed users/roles and run API:
   - `npm run db:seed`
   - `npm run dev`

Health endpoint:

- `GET http://localhost:3001/api/health`

## Scripts

- `npm run dev` - start NestJS in watch mode
- `npm run build` - compile TypeScript to `dist`
- `npm run db:migrate` - apply Prisma migrations
- `npm run db:seed` - seed initial users/roles
- `npm run lint` - run typecheck-based lint gate
- `npm run test` - run Node test runner
