# 🥊 Chacão Boxing Dashboard

The training dashboard of **Chacão Boxing Team**. Coaches build a library of
drills and drag them onto students for each training session: solo, in pairs,
in groups, or broadcast to everyone. Students log in to see their routine for
the day, and get a special alert when a sparring session is scheduled.

The UI is in Brazilian Portuguese and fully internationalized (see
[Adding a language](#adding-a-language)).

The platform is **multi-gym**: an **account admin** creates gyms, each with one
or more coaches; coaches create their students. Every drill, session and
account belongs to one gym and gyms never see each other's data.

| Role | Can do |
|---|---|
| Account admin (`ACCOUNT_ADMIN`) | Create/deactivate gyms, add coaches, reset coach passwords |
| Coach (`COACH`) | Everything in the coach module of their gym, create students |
| Student (`STUDENT`) | See their own routine and alerts |

## Features

**Coach module (admins and coaches)**
- **Session board**: drag drill cards onto students. Drop on a student for a solo
  drill, drag another student's avatar onto a card (or drag the card to another
  student) to make it a pair or group, or drop on **Todos** to broadcast it to
  everyone. Tick several students and drop once to assign a group drill.
  Reorder cards by dragging, click a card to edit rounds, minutes, notes and participants.
- **Publish**: sessions start as drafts; publishing makes them visible to students
  and sends in-app notifications.
- **Calendar**: regular sessions are created from the weekly schedule; add extra
  sessions on any day and use the red **Criar sparring** button for sparring days.
- **Drill library**: name, description, emoji, card color, category, default
  rounds/minutes, YouTube link (embedded preview) and an optional image link.
- **Students**: accounts get a server-generated password that is shown once;
  coaches can reset it at any time. Coaches are managed by the account admin.
- **Settings**: training weekdays (default Monday, Wednesday, Saturday), default
  start time and drill categories.

**Student module**
- **Hoje**: today's routine in order, with training partners, notes and video.
- **Próximos**: upcoming session dates (the drills only appear on the day).
- **Avisos**: notification bell, and a red banner for every upcoming sparring day.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4, dnd-kit, TanStack Query, react-i18next
- **Backend:** Django 5.2, Django REST Framework, SimpleJWT
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker Compose (dev profile with hot reload, production profile with nginx + gunicorn)

## Getting started (development)

```bash
cp .env.example .env        # then edit the passwords and secret key
docker compose up -d --build
```

- App: http://localhost:5180
- API: http://localhost:8010/api/

On first boot an **account admin** is created from `ADMIN_USERNAME` /
`ADMIN_PASSWORD` in `.env`. Log in with it, open **Academias**, create a gym
and its coaches, then log in as a coach to plan training. To load a demo gym
(Chacão Boxing Team) with drills, a coach and three students (their generated
passwords are printed once):

```bash
docker compose exec backend python manage.py seed_demo
```

For local testing there is also a seed with fixed, known logins — coach
`treinador`/`treinador` and students `aluno1`/`aluno1` … `aluno4`/`aluno4` —
plus exercises and the next class already planned, published and with everyone
checked in. It never changes accounts or classes that already exist, and the
test suite runs it on every `pytest` run so it keeps working:

```bash
docker compose exec backend python manage.py seed_test
```

## Running on the gym server (production profile)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The app is served at `http://<server>:8088` (`APP_PORT`). Add the server's LAN
IP or hostname to `DJANGO_ALLOWED_HOSTS`, its full origin to
`DJANGO_CSRF_TRUSTED_ORIGINS`, set `DJANGO_DEBUG=false` and a long random
`DJANGO_SECRET_KEY` in `.env`. Containers restart automatically with Docker.

## Tests

```bash
docker compose exec backend pytest
docker compose exec frontend npm test
docker compose exec frontend npm run typecheck
```

## Project layout

```
backend/
  accounts/        gyms (tenants), users, roles (ACCOUNT_ADMIN / COACH / STUDENT), generated passwords
  training/        drills, categories, weekly schedule, sessions, assignments, student routine API
  notifications/   in-app notifications (session published, sparring)
frontend/src/
  pages/admin/     account admin: gyms and their coaches
  pages/coach/     board, calendar, drills, accounts, settings
  pages/student/   today, upcoming
  i18n/locales/    UI translations (pt-BR)
```

## Adding a language

1. Copy `frontend/src/i18n/locales/pt-BR.json` to `<code>.json` and translate the values.
2. Register it in `frontend/src/i18n/index.ts`.
3. Optionally add a demo fixture at `backend/training/fixtures/demo_<code>.json`
   and run `seed_demo --locale <code>`.

## Project docs

- [`plan.md`](./plan.md): implementation plan, data model, decisions
- [`CLAUDE.md`](./CLAUDE.md): rules for AI agents working in this repo
