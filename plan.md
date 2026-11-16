# Chacão Boxing Dashboard — Implementation Plan

## 1. Goal

A web dashboard for **Chacão Boxing Team**, a boxing gym where one **coach** (admin role) plans training
for multiple **students**. The coach builds a reusable library of drills, then
drags drill cards onto students for each training session. A drill can be
assigned to one student (solo), a pair, a group, or broadcast to everyone.
Students log in and see their training routine for each day.

Visual identity: boxing colors — deep black backgrounds, blood/glove red
accents, white text, a touch of gold for highlights (belts/championship feel).
The app is branded as **Chacão Boxing Team** (name in the header, login screen,
and page titles). The gym's logo and brand assets will be dropped into
`frontend/src/assets/brand/` when provided; until then a text wordmark with a
🥊 glyph is used.

### Multi-gym architecture (2026-11-15)

The system is a **multi-gym platform**; Chacão Boxing Team is the first tenant.

- **Gym** is the tenant: every drill, category, weekly schedule, session,
  assignment and coach/student account belongs to exactly one gym. All coach
  and student API queries are scoped to `request.user.gym`; cross-gym ids are
  rejected (404 / validation error).
- **Roles**:
  - `ACCOUNT_ADMIN`: platform-level, belongs to no gym. Creates gyms (with one
    or more coaches), manages coaches (add, reset password, deactivate) and
    can deactivate gyms. Does not plan training. Bootstrapped from `.env`.
  - `COACH`: belongs to one gym; runs the coach module and creates students.
  - `STUDENT`: belongs to one gym; sees their routine.
- **Branding**: the header shows the user's gym name; the platform keeps the
  Chacão visual style (black/red, blue for the coach module) for every gym for
  now. Per-gym logo/colors can be added to the Gym model later.
- Existing data is migrated into a "Chacão Boxing Team" gym, and the former
  `ADMIN` role becomes `ACCOUNT_ADMIN`.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA |
| UI styling | Tailwind CSS | Custom red/black theme tokens |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible, touch-friendly |
| Data fetching | TanStack Query + Axios | Cache + optimistic updates for DnD |
| Routing | React Router | Separate coach and student areas |
| Backend | Django 5 + Django REST Framework | JSON API under `/api/` |
| Auth | `djangorestframework-simplejwt` | Access + refresh tokens |
| Database | PostgreSQL 16 | Own container + named volume |
| Infra | Docker Compose | `db`, `backend`, `frontend` services |
| Tests | pytest + pytest-django; Vitest + React Testing Library | |

Everything runs with a single `docker compose up`. No production/cloud concerns:
the target is a local server. A production-like profile (frontend built and
served by nginx, backend on gunicorn) is included so the gym server does not
run dev servers forever.

## 3. Domain model

```
User (Django auth user)
 └── Profile: role = ADMIN | COACH | STUDENT, display_name, avatar_emoji, color, active

WeeklySchedule (singleton, coach-editable)
 └── training_weekdays: [MON, WED, SAT]   default, fully configurable
     default_start_time

Drill  (reusable library item — "Toque no ombro", "Bater saco", ...)
 ├── name, description
 ├── emoji, card_color
 ├── youtube_url (optional), thumbnail_url (optional, external link only)
 ├── default_duration / rounds (optional), tags/category (warm-up, technique,
 │   conditioning, sparring, ...)
 └── archived (soft delete so history stays intact)

TrainingSession  (one concrete training day)
 ├── date, start_time, title, notes
 ├── kind = REGULAR | EXTRA | SPARRING
 │     REGULAR  → generated from WeeklySchedule weekdays
 │     EXTRA    → ad-hoc session (e.g. "this Thursday")
 │     SPARRING → special session, triggers a highlighted announcement
 └── status = DRAFT | PUBLISHED   (students only see published sessions)

Assignment  (a drill placed in a session for a set of students)
 ├── session → TrainingSession
 ├── drill   → Drill
 ├── participants → M2M Student   (1 = solo, 2 = pair, N = group)
 ├── is_broadcast (bool)          → applies to every active student
 ├── order (position in the day's routine), block (e.g. warm-up / main / cool-down)
 └── notes, rounds, duration override

Notification
 ├── recipient → User, kind = SESSION_PUBLISHED | SPARRING | BROADCAST | ...
 ├── title, body, session (optional)
 └── read_at
```

Key rules:

- **Shared assignments**: an assignment with participants B and C is a single
  record. Both B and C see it, and each sees who their partner(s) are.
- **Many groups per session**: a session holds any number of assignments, each
  with its own participant set, so A solo + (B, C) pair + (D, E, F) group can
  all coexist in one session.
- **Broadcast**: `is_broadcast = true` means the assignment shows for all
  active students in that session's routine (resolved at read time, so a
  student added later also sees it).
- **Sparring**: a dedicated "Create sparring" button creates a `SPARRING`
  session, and on publish sends a special notification to every student,
  displayed as a prominent red banner/alert on the student dashboard.
- **Configurable everything**: weekdays, default start time, drill categories,
  and session kinds' labels are editable from the coach module, never hardcoded.

## 4. API outline (`/api/`)

| Endpoint | Who | Purpose |
|---|---|---|
| `POST auth/token/`, `auth/token/refresh/`, `GET auth/me/` | all | Login + current user |
| `students/` CRUD, `students/{id}/reset-password/` | coach | Manage student accounts; generated passwords |
| `coaches/` CRUD | admin | Manage coach accounts |
| `drills/` CRUD | coach (read: all) | Drill library |
| `schedule/` GET/PUT | coach | Weekly training days config |
| `sessions/` CRUD, `?from=&to=` | coach | Sessions calendar |
| `sessions/generate/` POST | coach | Create REGULAR sessions for a date range from the schedule |
| `sessions/{id}/publish/` POST | coach | Publish + notify students |
| `sessions/sparring/` POST | coach | Create a sparring session (special notification) |
| `assignments/` CRUD, `assignments/reorder/` | coach | Board drag-and-drop operations |
| `me/routine/?date=` | student | Assignments for that day (own + broadcast) |
| `me/sessions/?from=&to=` | student | Upcoming sessions |
| `notifications/`, `notifications/{id}/read/` | all | In-app notifications |

Permissions: `IsCoach` for all write endpoints; students can only read their
own routine and notifications.

## 5. Frontend screens

**Coach module (admin)**
1. **Session board** (main screen): date picker/week strip at top; left
   sidebar = drill library as draggable cards; main area = one column per
   student plus a "Broadcast (everyone)" column.
   - Drag a drill onto a student → solo assignment.
   - Drag a drill onto an existing assignment card, or multi-select students
     then drop → pair/group assignment (card shows in every participant's
     column, linked visually with the same color and partner avatars).
   - Drag onto Broadcast → assignment for everyone.
   - Reorder cards within a column; click a card to edit notes/rounds.
   - "Publish" button; draft badge until published.
2. **Calendar**: month/week view of sessions; "New extra session" and a red
   "🥊 Create sparring" button.
3. **Drill library**: grid of drill cards (emoji, color, title, YouTube link);
   create/edit form with emoji picker and color picker; live card preview.
4. **Students**: list, create (username + temporary password), deactivate.
5. **Settings**: training weekdays, default time, categories.

**Student module**
1. **Today**: the day's routine as cards in order, broadcast items marked,
   partner names shown for pair/group drills, embedded YouTube video on expand.
2. **Upcoming**: next sessions with kind badges (sparring highlighted).
3. **Notifications**: bell with unread count; sparring alerts as a red banner.

## 6. Docker Compose layout

```
docker-compose.yml          # dev: hot reload for both apps
docker-compose.prod.yml     # override: nginx-served build + gunicorn
backend/   Dockerfile, Django project `config`, apps: accounts, training, notifications
frontend/  Dockerfile (dev) + Dockerfile.prod (multi-stage → nginx)
.env.example                # DB credentials, Django secret, initial coach account
```

Services: `db` (postgres:16-alpine, healthcheck, named volume), `backend`
(waits for db, runs migrations, port 8000), `frontend` (Vite on 5173, proxies
`/api` to backend). Ports chosen to avoid collisions with other local stacks
and are configurable via `.env`.

A management command `seed_demo` creates a coach, a few students, and sample
drills so the board can be tried immediately.

## 7. Delivery phases (one small commit or a few per step)

1. **Repo bootstrap** — plan.md, CLAUDE.md, README.md, .gitignore.
2. **Infra skeleton** — Compose file, backend + frontend Dockerfiles, `.env.example`,
   Django and Vite hello-world wired together through the API proxy.
3. **Auth & roles** — Profile model, JWT login, `IsCoach` permission, login page,
   role-based routing in React.
4. **Drill library** — model, API, tests; coach UI with emoji/color pickers and card preview.
5. **Schedule & sessions** — WeeklySchedule config, session generation, extra
   sessions, calendar UI.
6. **Assignments & board** — Assignment model with M2M participants and broadcast,
   API + tests for shared visibility; drag-and-drop session board.
7. **Student dashboard** — today's routine, upcoming sessions, YouTube embeds.
8. **Publish, sparring & notifications** — publish flow, sparring button,
   notification model, bell + sparring banner.
9. **Polish** — theme pass, empty states, responsive layout (phone view for
   students), seed data, README run instructions, prod compose profile.

Each phase ends with tests passing and the stack booting with `docker compose up`.

**Status (2026-11-15):** phases 1–9 are implemented. Additional decisions made
while building:

- Ports: dev frontend `5180`, dev API `8010`, production profile `8088` (avoids
  other CodeVault stacks on 5173/8000/8080).
- Regular sessions are materialized from the schedule on demand (only for today
  onward) when the coach opens the calendar or board.
- Creating a sparring session on a day that only has an untouched regular draft
  replaces that draft.
- Notifications store a kind + session and the UI renders the text, so they are
  translatable. Publishing alerts students who have drills in the session
  (everyone when there is a broadcast drill or for sparring); re-publishing
  never duplicates alerts.
- Demo content lives in `backend/training/fixtures/demo_pt-BR.json` (locale
  content, like the UI translations).

## 8. Out of scope for now

- File uploads (thumbnails are emoji + color, optional external image URL;
  videos are YouTube links only).
- Email/push notifications (in-app only).
- Cloud deployment, HTTPS, backups.
- Payments.
- Attendance tracking and progress metrics beyond what phase 10 adds
  (check-in and monthly assessments).

## 9. Confirmed decisions (2026-11-15)

1. **UI language**: Portuguese (pt-BR) only for now, but fully internationalized
   from day one (`react-i18next`, all UI strings in locale files under
   `frontend/src/i18n/locales/`; backend messages through Django's `gettext`).
   Adding a language = adding a locale file.
2. **Student accounts**: the coach creates them. The backend generates a random
   password, shown once to the coach to hand to the student. The coach can
   reset a student's password (new generated password, shown once). No email.
3. **Notifications**: in-app only (bell + red sparring banner).
4. **Completion**: students only view their routine; no "done" tracking. A
   routine is valid for its session day only — the student dashboard shows
   today's routine; upcoming sessions show date/kind (e.g. sparring) but not
   the drills ahead of time; past routines are not shown to students.
5. **Pair/group building on the board**: confirmed — drop a drill on a student,
   then drop other students onto that card to join; or multi-select students
   and drop once.
6. **Roles**: three roles — `ADMIN` (system owner, manages coaches and
   everything else), `COACH` (multiple coaches supported), `STUDENT`. An admin
   account is created from `.env` on first boot. Admins and coaches share the
   coach module; only admins can manage coach accounts.

## 10. Phase 10 — Periodization, assessments, check-in and gamification (2026-11-16)

Source: feedback from the project manager plus Gustavo's additions. This
phase turns the drill board into a periodized training plan. Everything is
additive: existing sessions, drills and assignments keep working, and new
tables arrive through migrations (the database holds real gym data, so
nothing is wiped).

### 10.1 Requirements (summary)

- **Coach** registers students, their assessments (stats), weekly focuses,
  notes and homework; builds the cycles and each class's workout; sees who
  checked in and injury alerts; confirms attendance.
- **Student** sees their stats, coach notes and the two focuses of the week,
  the current cycle and the week's objective, homework, XP, fighter class and
  missions; checks in before a deadline with an optional pain/injury report.
- **Periodization**: three coach-configurable levels. A **macrocycle** (the
  big cycle, e.g. a semester) holds an ordered list of **mesocycles**; each
  mesocycle trains one valence and holds an ordered list of **microcycles**
  with a phase (adaptation, development, shock, recovery/assessment) and an
  objective. The coach sets durations and orders valences by drag and drop;
  each class inherits its microcycle's objective. Students see the plan.
- **Class blocks**: mobility and general warm-up (collective, fixed time) →
  specific warm-up (individual, starts when each student finishes the general
  one) → boxing school and combat (pairs) → cool-down.
- **Gamification**: XP for attending classes and completing missions; levels
  come from XP; coach-configurable fighter classes and missions.
- **Profile**: each user marks left- or right-handed and describes their
  limitations (injuries, sparring or equipment restrictions). *(Done.)*

### 10.2 Mapping onto the existing model

| Concept | Existing piece | Change |
|---|---|---|
| Class workout | `TrainingSession` + `Assignment` | `Assignment.block`; the board groups cards by block |
| Collective blocks | Broadcast assignment | Mobility, general warm-up and cool-down default to broadcast |
| Individual specific warm-up | Solo assignment | Placed in the specific warm-up block |
| Pairs for school/combat | Pair assignment | Built by the coach on the board (no automatic suggestions) |
| Big cycle | — | `Macrocycle` with a start date |
| Valence block | — | `Mesocycle` (ordered in a macrocycle, one `Valence`) |
| Week phase/objective | — | `Microcycle` (ordered in a mesocycle); sessions resolve it by date |
| Stats 1–5 | — | `Metric` + `Assessment` (monthly) |
| Weekly focuses | — | `FocusOption` list (like drill categories) + `WeeklyFocus` |
| Observations | — | `CoachNote` |
| Homework | — | `Homework` (per student or everyone, per week) |
| Check-in + pain | — | `CheckIn` with optional pain report; gym deadline setting |
| Injury alerts | `Notification` | New kind `INJURY_REPORTED` for the gym's coaches |
| XP, levels, classes, missions | — | `XpEvent`, `FighterClass`, `Mission`, `MissionCompletion` |
| Handedness, limitations | `User` | `handedness`, `limitations` *(done)* |

### 10.3 New and changed models (all gym-scoped)

```
Valence            gym, name, order, archived
                   seeded: speed, strength, endurance, power,
                   coordination, agility
Macrocycle         gym, name, start_date, notes
Mesocycle          macrocycle, order, valence → Valence, name, notes
MicrocyclePhase    gym, name, order        seeded: adaptation, development,
                                           shock, recovery/assessment
Microcycle         mesocycle, order, phase → MicrocyclePhase, objective,
                   length_days (default 7)
                   A new mesocycle starts with 4 microcycles (one per seeded
                   phase); the coach can add, remove or resize them.
TrainingSession    + objective_override (blank = inherit the microcycle's)
SessionBlock       gym, name, order, mode = COLLECTIVE | INDIVIDUAL | PAIRS,
                   start_offset_minutes (collective blocks only)
                   seeded: mobility, general warm-up (COLLECTIVE),
                   specific warm-up (INDIVIDUAL), boxing school, combat
                   (PAIRS), cool-down (COLLECTIVE)
Assignment         + block → SessionBlock (nullable; existing rows show as
                   "no block" until the coach moves them)
Metric             gym, name, group = PHYSICAL | TECHNICAL, order, archived
                   seeded: speed, strength, endurance, mobility (PHYSICAL);
                   guard, footwork, coordination, defense (TECHNICAL)
Assessment         student, metric, period (first day of month), score 1–5,
                   notes             unique (student, metric, period)
FocusOption        gym, name, emoji, color, order, archived
WeeklyFocus        student, week_start (Monday), position (1 | 2),
                   focus → FocusOption, note
CoachNote          student, author, body, visible_to_student, created_at
Homework           gym, week_start, title, description, drill (optional),
                   participants M2M (empty + is_broadcast = everyone)
CheckIn            session, student, created_at, has_pain,
                   pain_location, pain_level 0–10, notes,
                   attended (null until the coach confirms)
                   unique (session, student)
Gym                + checkin_deadline_minutes (default 120)
                   + attendance_xp (default 10), xp_per_level (default 100)
User               + handedness = LEFT | RIGHT | UNSPECIFIED, limitations
                   + fighter_class → FighterClass (nullable)
FighterClass       gym, name, description, emoji, color, order, archived
                   seeded: Out-Boxer, Swarmer (In-Fighter), Slugger
                   (Brawler), Boxer-Puncher, Counterpuncher, Switch-hitter
Mission            gym, title, description, xp_reward, active,
                   starts_on / ends_on (optional), repeatable
MissionCompletion  mission, student, status = PENDING | APPROVED | REJECTED,
                   created_at, reviewed_by, reviewed_at
XpEvent            student, amount, reason = ATTENDANCE | MISSION | MANUAL,
                   session / mission_completion (optional), note, created_at
                   (XP total is the sum of events, so it can be audited)
```

Valences and metrics stay separate lists, following the PM's suggestion that
mobility and technique are assessed but are not a cycle's valence.
Seeded lists are created per gym by a data migration (existing gyms) and on
gym creation; the coach edits them in Settings, like drill categories.

### 10.4 Rules

- Cycle dates are derived from the macrocycle's start date and the ordered
  lengths of its microcycles, so reordering mesocycles shifts the calendar.
  A session belongs to the microcycle whose date range contains its date;
  sessions outside any macrocycle simply have no objective.
- Students check in for a published session until
  `start_time − checkin_deadline_minutes`; after that check-in is closed.
  The coach can add or remove check-ins at any time.
- A check-in with `has_pain` notifies the gym's coaches and flags the student
  on the board; the coach decides whether they train.
- No automatic pair suggestions: the coach builds pairs on the board, which
  shows who checked in, their handedness and pain flags.
- Attendance XP: after the class the coach confirms attendance (checked-in
  students pre-marked as present); confirming grants `attendance_xp` once per
  (student, session); un-confirming removes it.
- Missions: the student marks a mission as done, the coach approves, and
  approval grants its XP. The coach can also grant or remove XP manually.
- Level = `1 + total_xp // xp_per_level`. The fighter class is set by the
  coach on the student (a style, not a level).
- Students see their own assessments (current month + history), notes marked
  visible, this week's focuses, objective and homework, the macrocycle plan,
  XP, level, class and missions. Today's routine rule (decision 4) is
  unchanged.

### 10.5 Delivery steps

0. Profile: handedness and limitations. *(Done.)*
1. Periodization backend: valences, phases, macro/meso/microcycles, date
   derivation, session objective resolution, API + isolation tests.
2. Cycle planner UI (coach) + read-only plan for students.
3. Session blocks: `SessionBlock` + `Assignment.block`; board grouped into
   block lanes; collective blocks show their fixed time.
4. Assessments backend + coach UI (student × metric grid, 1–5, per month).
5. Focus options, weekly focuses, coach notes and homework.
6. Check-in backend: deadline setting, pain report, coach notification.
7. Student UI: week card (objective, focuses, homework), stats page, check-in
   form with pain fields.
8. Coach check-in panel: confirmed list, injury alerts, attendance
   confirmation.
9. Gamification backend: fighter classes, missions, XP events, levels;
   coach configuration UI.
10. Gamification student UI: XP bar, level, class, missions.
