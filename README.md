# 🥊 Chacão Boxing Dashboard

The training dashboard of **Chacão Boxing Team**. The coach builds a library of drills and
drags them onto students for each training session — solo, in pairs, in
groups, or broadcast to everyone. Students log in to see their routine for the
day, and get a special alert when a sparring session is scheduled.

> Status: **planning**. See [`plan.md`](./plan.md) for the architecture and roadmap.

## Features (planned)

- **Coach (admin) module**
  - Drill library with emoji, card color, description, and YouTube video link
  - Drag-and-drop session board: assign drills to one student, a pair, a group,
    or everyone (broadcast)
  - Configurable weekly schedule (default: Monday, Wednesday, Saturday)
  - Extra one-off sessions and a dedicated **Create sparring** button
  - Student account management
- **Student module**
  - Today's routine as cards, with training partners shown
  - Upcoming sessions and in-app notifications (sparring highlighted)

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, dnd-kit, TanStack Query
- **Backend:** Django, Django REST Framework, SimpleJWT
- **Database:** PostgreSQL
- **Infrastructure:** Docker Compose

## Getting started

> Available once the infrastructure phase lands.

```bash
cp .env.example .env
docker compose up --build
```

Then open the frontend at `http://localhost:5173`.

## Project docs

- [`plan.md`](./plan.md) — implementation plan, data model, phases
- [`CLAUDE.md`](./CLAUDE.md) — rules for AI agents working in this repo
