# CLAUDE.md — Chacão Boxing Dashboard

Guidance for AI agents (Claude Code and others) working in this repository.

## Project

Boxing training dashboard: a coach (admin) plans training sessions and assigns
drills to students (solo, pairs, groups, or broadcast to all). React frontend,
Django REST backend, PostgreSQL, fully containerized with Docker Compose.
See [`plan.md`](./plan.md) for architecture, data model, and delivery phases.

## Mandatory rules

1. **English only for all generated artifacts.** Code, identifiers, comments,
   docstrings, commit messages, README, docs, plan files, test names, and API
   field names must be written in English — even when the conversation with the
   user happens in Portuguese. The only exception is user-facing UI copy, which
   is pt-BR and lives exclusively in i18n locale files — never hardcode UI
   strings in components; translation keys are English.
2. **Commits use only the user's git identity** configured on the machine.
   - Never add `Co-Authored-By` trailers, "Generated with Claude Code" lines,
     or any other AI attribution to commit messages.
   - Never pass `--author` or override `user.name` / `user.email`.
3. **Small, focused commits.** Commit after each step of the plan; one logical
   change per commit. Use conventional-style messages
   (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
4. **Everything runs in Docker.** New services or dependencies must be wired
   into `docker-compose.yml`; do not rely on tools installed on the host.
5. **Never commit secrets.** Real values live in `.env` (git-ignored); keep
   `.env.example` updated with safe placeholders.

## Conventions

- Backend: Django apps under `backend/` (`accounts`, `training`,
  `notifications`, `progress` for assessments/focuses/notes/homework,
  `gamification` for XP, missions and fighter classes). DRF viewsets +
  serializers; permissions enforce that only the coach can write. Tests with
  pytest-django.
- Coach-editable starter lists (valences, phases, class blocks, metrics,
  fighter classes) are seeded per gym from
  `training/fixtures/gym_defaults_pt-BR.json` via `seed_gym_defaults` — on gym
  creation (signals) and for existing gyms (data migrations). Never wipe data:
  the database holds real gym data, so schema changes are additive migrations.
- Profile photos are uploads in the `media-data` volume, served by Django at
  `/media/`. Fighter class art is bundled in `frontend/src/assets/fighter-classes/`.
- Frontend: `frontend/` — React + TypeScript + Vite, Tailwind for styling,
  `@dnd-kit` for drag and drop, TanStack Query for server state. Tests with Vitest.
- Theme: boxing colors — black backgrounds, red accents, white text, gold
  highlights. Keep colors as Tailwind theme tokens, not ad-hoc hex values.
  `glove` is the accent: fixed red for coaches and account admins, and the
  gym's own color (`Gym.color`, default red) in the student area
  (`data-theme="student"`). Use `blood` for sparring, which stays red everywhere.
- Multi-gym: every tenant-owned query must be filtered by `request.user.gym`
  (use `GymScopedViewSet` / `GymScopedSerializer` in `training`), and every new
  endpoint needs a cross-gym isolation test (see `training/test_gym_isolation.py`).
- Scheduled jobs run in the `scheduler` service (`run_scheduler`, same backend
  image); weekly absences close every Sunday at 23:00 server time.
- Keep `seed_test` (fixture `training/fixtures/test_seed_pt-BR.json`) working when
  models change; `training/test_seed.py` runs it on every test run.
- Nothing about the schedule is hardcoded: training weekdays, times, and
  categories come from coach-editable configuration.

## Common commands

```bash
docker compose up --build                 # start the full stack
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
docker compose exec backend python manage.py seed_test   # known test logins (treinador, aluno1..4)
docker compose exec backend python manage.py record_weekly_absences --previous  # re-close last week
docker compose exec backend pytest
docker compose exec frontend npm test
```

On this Windows host, use `npm.cmd` instead of `npm` when running Node outside Docker.
