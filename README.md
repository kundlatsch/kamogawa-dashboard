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
| Student (`STUDENT`) | Check in, see their classes, routine, stats, missions and the ranking |

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
- **Ranking and missions**: attendance and absences, missions as weekly goals,
  fighter classes with artwork (or a custom image).
- **Settings** (tabs): gym, class times per weekday, check-in deadline, class
  blocks, categories, focuses, valences, phases, metrics, fighter classes.

**Student**
- **Hoje**: today's class with check-in, the week's objective, focuses and homework.
- **Calendário**: every class day; check in ahead of time on any class, open
  published classes to see the exercises.
- **Plano, Estatísticas, Missões, Ranking**: the training plan, monthly scores
  and coach notes, missions and the gym ranking.
- **Profile**: photo, stance, limitations and classes per week.

**Automation**
- Every Sunday at 23:00 the `scheduler` service closes the week: absences are the
  classes a student committed to minus their check-ins (cancelled classes do not count).

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, dnd-kit, TanStack Query, react-i18next
- **Backend:** Django 5.2, Django REST Framework, SimpleJWT, Pillow
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose — development profile with hot reload,
  production profile with nginx + gunicorn

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

## Production (gym server)

The production profile builds the frontend into static files served by nginx,
runs Django on gunicorn, and keeps the source out of the containers.

1. **Configure `.env`** on the server:

   ```dotenv
   DJANGO_DEBUG=false
   DJANGO_SECRET_KEY=<a long random string>
   POSTGRES_PASSWORD=<a strong password>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<a strong password>
   # The server's LAN IP or hostname, so phones on the gym network can connect
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,192.168.0.10
   DJANGO_CSRF_TRUSTED_ORIGINS=http://192.168.0.10:8088
   APP_PORT=8088
   TZ=America/Sao_Paulo
   ```

   `TZ` matters: check-in deadlines and the Sunday 23:00 job use the server time zone.

2. **Start the stack:**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

   The app is served at `http://<server>:<APP_PORT>` (default 8088); nginx
   proxies `/api`, `/media` and the Django admin to the backend. Containers
   restart automatically with Docker.

3. **Log in as the account admin**, create the gym and its coaches under
   **Academias**, then hand the coaches their generated passwords.

**Updating** to a new version:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrations are applied on start; they are additive and keep existing data.

**Backups** — the database lives in the `postgres-data` volume and profile
photos and class images in `media-data`:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup.dump
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean' < backup.dump
```

The app has no HTTPS of its own; it is meant for a local network. To expose it
on the internet, put it behind a reverse proxy that terminates TLS and add the
public origin to `DJANGO_CSRF_TRUSTED_ORIGINS`.

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
  gamification/    fighter classes, missions, ranking
  notifications/   in-app notifications
frontend/src/
  pages/admin/     account admin: gyms and their coaches
  pages/coach/     planning board, calendar, cycles, week, assessments, ranking, settings
  pages/student/   today, calendar, class, plan, stats, missions, ranking
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
