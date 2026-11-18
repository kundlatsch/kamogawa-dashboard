# 🥊 Kamogawa Dashboard

A multi-gym boxing training dashboard. Coaches plan periodized training
(macro, meso and microcycles), build each class from a library of exercises
and assign them by class block to students who checked in: solo, in pairs, in
groups or to everyone. Students check in before class (reporting pain or
injuries), follow their routine, stats and weekly goals, and see the ranking.
The first gym on the platform is **Chacão Boxing Team**.

The UI is in Brazilian Portuguese and fully internationalized (see
[Adding a language](#adding-a-language)).

## Roles

| Role | Can do |
|---|---|
| Account admin (`ACCOUNT_ADMIN`) | Create and deactivate gyms, add coaches, reset coach passwords |
| Coach (`COACH`) | Everything about their gym: planning, students, assessments, settings |
| Student (`STUDENT`) | Check in, see their classes, routine, stats and the ranking |

Every exercise, class and account belongs to one gym; gyms never see each
other's data.

## Features

**Coach**
- **Planejamento**: the next class, split into blocks (mobility, warm-ups, boxing
  school, combat, cool-down…). Only students who checked in get a column, each
  showing their fighting style, strengths, weaknesses, stance, limitations and
  pain reports. Drag exercises onto students, pairs, groups or everyone.
- **Calendar**: click a day to open its class, turn it into sparring, cancel it
  with a reason (holiday, trip…) or add an extra class.
- **Cycles**: macrocycle → mesocycles (one valence each, reorderable) →
  microcycles (phase and objective); every class inherits its week's objective.
- **Week**: two weekly focuses per student, coach notes and homework.
- **Assessments**: monthly scores per metric on a configurable scale (1–10 by default).
- **Ranking**: attendance and absences, and each student's fighter class with
  artwork (or a custom image).
- **Settings** (tabs): gym, class times per weekday, check-in deadline, class
  blocks, categories, focuses, valences, phases, metrics, fighter classes.

**Student**
- **Hoje**: today's class with check-in, the week's objective, focuses and homework.
- **Calendário**: every class day; check in ahead of time on any class, open
  published classes to see the exercises.
- **Plano, Estatísticas, Ranking**: the training plan, monthly scores and coach
  notes, and the gym ranking with their own fighter class.
- **Profile**: photo, stance, limitations and classes per week.

**Automation**
- Every Sunday at 23:00 the `scheduler` service closes the week: absences are the
  classes a student committed to minus their check-ins (cancelled classes do not count).

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, dnd-kit, TanStack Query, react-i18next
- **Backend:** Django 5.2, Django REST Framework, SimpleJWT, Pillow
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose — development profile with hot reload,
  production stack with nginx + gunicorn; GitHub Actions CI/CD to GHCR, Watchtower updates

Everything runs in Docker; the host only needs Docker (with Compose v2.24+).

## Local development

```bash
cp .env.example .env          # set passwords and a secret key
docker compose up -d --build
```

| Service | URL / role |
|---|---|
| `frontend` | http://localhost:5180 (Vite, hot reload) |
| `backend` | http://localhost:8010/api/ (Django dev server) |
| `db` | PostgreSQL, data in the `postgres-data` volume |
| `scheduler` | Weekly jobs (absences every Sunday at 23:00) |

Migrations run automatically on start. On first boot an **account admin** is
created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`.

### Test data

Load a gym with known logins — coach `treinador`/`treinador`, students
`aluno1`/`aluno1` … `aluno4`/`aluno4` — plus exercises and the next class
already planned with everyone checked in:

```bash
docker compose exec backend python manage.py seed_test
```

It never changes accounts or classes that already exist. Use it only on test
installs: the passwords are public. (`seed_demo` loads a similar demo gym with
generated passwords instead.)

### Tests

```bash
docker compose exec backend pytest
docker compose exec frontend npm test
docker compose exec frontend npm run typecheck
```

The backend suite also runs `seed_test`, so the seed keeps working as models change.

## Production (home server)

Deployment is continuous and pull-based:

1. Every push to `main` runs the tests on GitHub Actions
   ([`.github/workflows/ci-cd.yml`](./.github/workflows/ci-cd.yml)). If they pass, the
   backend (gunicorn) and frontend (nginx serving the built app) images are published to
   GitHub Container Registry, tagged `latest` and `sha-<commit>`, for x86-64 and ARM64.
2. The server runs [`docker-compose.prod.yml`](./docker-compose.prod.yml) with those images.
   Watchtower checks GHCR hourly (configurable) and recreates the app containers when a new
   image appears; the backend applies migrations on start.

The server needs only Docker, `docker-compose.prod.yml` and a `.env` based on
[`.env.prod.example`](./.env.prod.example): no source code, no build, and no inbound
connection from GitHub. Optional services: nightly database and uploads backups, and a
Cloudflare Tunnel for public HTTPS access.

Step-by-step instructions: **[docs/server-setup.md](./docs/server-setup.md)**.

## Useful commands

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_test
docker compose exec backend python manage.py record_weekly_absences --previous   # re-close last week
docker compose logs -f scheduler
```

## Project layout

```
backend/
  accounts/        gyms (tenants), users and roles, profile photos
  training/        exercises, schedule, classes and blocks, assignments, cycles, check-ins,
                   weekly absences, student endpoints, scheduler commands
  progress/        metrics and monthly assessments, weekly focuses, coach notes, homework
  gamification/    fighter classes, ranking
  notifications/   in-app notifications
frontend/src/
  pages/admin/     account admin: gyms and their coaches
  pages/coach/     planning board, calendar, cycles, week, assessments, ranking, settings
  pages/student/   today, calendar, class, plan, stats, ranking
  i18n/locales/    UI translations (pt-BR)
  assets/          fighter class artwork
```

## Adding a language

1. Copy `frontend/src/i18n/locales/pt-BR.json` to `<code>.json` and translate the values.
2. Register it in `frontend/src/i18n/index.ts`.
3. Optionally add `backend/training/fixtures/demo_<code>.json` and run `seed_demo --locale <code>`.

## Project docs

- [`plan.md`](./plan.md): implementation plan, data model and product decisions
- [`CLAUDE.md`](./CLAUDE.md): rules for AI agents working in this repository
