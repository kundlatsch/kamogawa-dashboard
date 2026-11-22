<div align="center">

# 🥊 Kamogawa Dashboard

**Boxing training dashboard for coaches and their students.**

Plan periodized training, build each class from an exercise library, and follow every fighter's progress.

[![CI/CD](https://github.com/kundlatsch/kamogawa-dashboard/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/kundlatsch/kamogawa-dashboard/actions/workflows/ci-cd.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

[Features](#features) · [Getting started](#getting-started) · [Deployment](#deployment) · [Contributing](#contributing)

<img src="docs/screenshots/planning-board.png" alt="Planning board: the next class split into blocks, with one column per student who checked in" width="100%">

</div>

## About

Kamogawa Dashboard runs the day-to-day of a boxing gym. The coach plans the season in cycles, builds each class by dragging exercises onto the students who checked in, and keeps each fighter's style, stats and goals up to date. Students check in, see their class and follow their own progress.

It supports several gyms on one install, each with its own coaches, students and data. The first gym using it is **Chacão Boxing Team**. The UI is in Brazilian Portuguese and ready for translation.

## Features

**For coaches**
- **Planning board:** the next class split into blocks (mobility, warm-up, boxing school, combat, cool-down). Drag exercises onto one student, a pair, a group or everyone. Each column shows the fighter's style, strengths, weaknesses, stance and limitations.
- **Calendar and cycles:** regular classes from the weekly schedule, sparring days, extra or cancelled classes, and macro, meso and microcycles that give every class its objective.
- **Student profile:** level, main and secondary fighter style, free-text strengths, weaknesses and focuses, and coach notes.
- **Student stats:** a score per skill on a configurable scale, with a rating guide from beginner to competition level.
- **Attendance and ranking:** check-ins, weekly absences closed automatically every Sunday, and an attendance ranking.

**For students**
- Check in to any upcoming class and report pain or injuries.
- See today's class, the training plan, their stats with history, and the ranking.

<table>
  <tr>
    <td><img src="docs/screenshots/student-profile.png" alt="Coach view of a student profile with main and secondary fighter style"></td>
    <td><img src="docs/screenshots/student-stats.png" alt="Student stats grid with the rating guide"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/calendar.png" alt="Class calendar"></td>
    <td><img src="docs/screenshots/student-my-stats.png" alt="A student's own stats page"></td>
  </tr>
</table>

## Built with

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, TanStack Query, dnd-kit, react-i18next |
| Backend | Django 5.2, Django REST Framework, SimpleJWT |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose, nginx, gunicorn, GitHub Actions, GHCR, Watchtower |

## Getting started

You only need [Docker](https://docs.docker.com/get-docker/) with Compose v2.24 or newer.

```bash
git clone https://github.com/kundlatsch/kamogawa-dashboard.git
cd kamogawa-dashboard
cp .env.example .env          # set passwords and a secret key
docker compose up -d --build
```

Open **http://localhost:5180**. The API runs on http://localhost:8010/api/, and migrations run on start. On first boot, an account admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.

### Test data

```bash
docker compose exec backend python manage.py seed_test
```

This creates a gym with known logins: the coach `treinador` / `treinador` and the students `aluno1` / `aluno1` to `aluno4` / `aluno4`. It also adds exercises and plans the next class. Use it only on test installs, because these passwords are public.

### Running the tests

```bash
docker compose exec backend pytest
docker compose exec frontend npm test
```

## Deployment

Every push to `main` runs the tests and publishes the backend and frontend images to GitHub Container Registry. The server runs [`docker-compose.prod.yml`](./docker-compose.prod.yml), and Watchtower pulls new images on its own. The server needs no source code and no inbound connection from GitHub.

See the step-by-step **[server setup guide](./docs/server-setup.md)**.

## Contributing

Issues and pull requests are welcome. Before opening a pull request:

1. Keep commits small and focused, with [conventional](https://www.conventionalcommits.org/) messages (`feat:`, `fix:`, `docs:`).
2. Write code, comments and docs in English. UI text goes in `frontend/src/i18n/locales/`, never in components.
3. Make sure both test suites pass.

To add a language, copy `frontend/src/i18n/locales/pt-BR.json` to a new file, translate the values, and register it in `frontend/src/i18n/index.ts`.

## Author

Developed by **[Taguma](https://github.com/kundlatsch)**.
