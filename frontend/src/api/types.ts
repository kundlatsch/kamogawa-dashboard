export type Role = "ACCOUNT_ADMIN" | "COACH" | "STUDENT";

export interface GymSummary {
  id: number;
  name: string;
  slug: string;
  /** Accent color of the student area. */
  color: string;
  /** Monthly assessments are scored from 1 to this value. */
  assessment_scale_min: number;
  assessment_scale_max: number;
  /** Students check in until this many minutes before class (only sent to coaches). */
  checkin_deadline_minutes?: number;
}

export interface Gym extends GymSummary {
  is_active: boolean;
  created_at: string;
  coach_count: number;
  student_count: number;
}

export type Handedness = "UNSPECIFIED" | "RIGHT" | "LEFT";

/** Skill level the coach sets for a student; "" = not set yet. */
export type Level = "" | "BEGINNER" | "BEGINNER_INTERMEDIATE" | "INTERMEDIATE" | "INTERMEDIATE_ADVANCED" | "ADVANCED";

export const LEVELS: Exclude<Level, "">[] = [
  "BEGINNER",
  "BEGINNER_INTERMEDIATE",
  "INTERMEDIATE",
  "INTERMEDIATE_ADVANCED",
  "ADVANCED",
];

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  color: string;
  handedness: Handedness;
  limitations: string;
  /** Classes a week the student committed to (weekly absences); null = not tracked. */
  weekly_classes: number | null;
  /** Coach-assigned skill level. */
  level: Level;
  /** Coach-assigned fighting style (id of a FighterClass). */
  fighter_class: number | null;
  /** Optional second style the fighter mixes in; never the same as fighter_class. */
  secondary_fighter_class: number | null;
  /** What the student should work on, written freely by the coach. */
  focus_text: string;
  /** UI language picked on the profile ("en", "pt-BR"); blank = automatic. */
  language: string;
  role: Role;
  gym: GymSummary | null;
  is_active: boolean;
}

export interface PublicUser {
  id: number;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  color: string;
}

export interface GeneratedPassword {
  id: number;
  generated_password: string;
}

export interface DrillCategory {
  id: number;
  name: string;
  color: string;
  order: number;
}

export interface Drill {
  id: number;
  name: string;
  description: string;
  emoji: string;
  color: string;
  youtube_url: string;
  thumbnail_url: string;
  category: number | null;
  default_rounds: number | null;
  default_duration_minutes: number | null;
  archived: boolean;
}

export interface WeeklySchedule {
  training_weekdays: number[];
  default_start_time: string;
  /** Class time per weekday (Monday = "0"), "HH:MM"; missing days use default_start_time. */
  weekday_times: Record<string, string>;
}

export type SessionKind = "REGULAR" | "EXTRA" | "SPARRING";
export type SessionStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export interface TrainingSession {
  id: number;
  date: string;
  start_time: string | null;
  title: string;
  notes: string;
  kind: SessionKind;
  status: SessionStatus;
  published_at: string | null;
  /** Set by the coach; blank means the session inherits its microcycle's objective. */
  objective_override: string;
  /** Resolved objective (override or the microcycle's). */
  objective: string;
  /** Why the class was cancelled (holiday, trip...). */
  cancel_reason: string;
}

export interface Assignment {
  id: number;
  session: number;
  drill: number;
  drill_detail: Drill;
  participants: number[];
  is_broadcast: boolean;
  /** Class block (mobility, warm-up, ...); null for drills created before blocks existed. */
  block: number | null;
  order: number;
  notes: string;
  rounds: number | null;
  duration_minutes: number | null;
}

export interface SessionSummary {
  id: number;
  date: string;
  start_time: string | null;
  title: string;
  notes: string;
  kind: SessionKind;
}

export interface RoutineItem {
  id: number;
  drill: Drill;
  block: SessionBlock | null;
  is_broadcast: boolean;
  order: number;
  notes: string;
  rounds: number | null;
  duration_minutes: number | null;
  partners: PublicUser[];
}

export interface MyCheckIn {
  id: number;
  has_pain: boolean;
  pain_location: string;
  pain_level: number | null;
  notes: string;
  created_at: string;
}

export interface CheckInState {
  /** ISO datetime after which only the coach can change the check-in. */
  deadline: string;
  open: boolean;
  mine: MyCheckIn | null;
}

export interface CheckIn extends MyCheckIn {
  session: number;
  student: number;
  added_by_coach: boolean;
  /** Null until the coach confirms who actually came. */
  attended: boolean | null;
}

export type UpcomingSession = SessionSummary & { checkin: CheckInState };

export interface MyRoutine {
  date: string;
  sessions: (SessionSummary & { objective: string; checkin: CheckInState; routine: RoutineItem[] })[];
  /** Today's classes not published yet: only time and check-in. */
  drafts?: { id: number; date: string; start_time: string | null; checkin: CheckInState }[];
}

export interface AppNotification {
  id: number;
  kind: "SESSION_PUBLISHED" | "SPARRING" | "INJURY_REPORTED" | "SESSION_CANCELLED";
  session: SessionSummary | null;
  /** Who the notification is about (e.g. the student who reported pain). */
  subject: PublicUser | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationList {
  unread: number;
  results: AppNotification[];
}

/** Coaches run the coach module of their gym. */
export const isCoach = (user: User | null | undefined) => user?.role === "COACH";

/** Coach-editable list item (valences, microcycle phases, ...). */
export interface NamedItem {
  id: number;
  name: string;
  color: string;
  order: number;
  archived: boolean;
}

export interface PlannedMicrocycle {
  id: number;
  order: number;
  objective: string;
  length_days: number;
  phase: NamedItem | null;
  start_date: string;
  end_date: string;
}

export interface PlannedMesocycle {
  id: number;
  name: string;
  notes: string;
  order: number;
  valence: NamedItem;
  start_date: string | null;
  end_date: string | null;
  microcycles: PlannedMicrocycle[];
}

export interface Macrocycle {
  id: number;
  name: string;
  start_date: string;
  notes: string;
  end_date: string | null;
  mesocycles: PlannedMesocycle[];
}

export interface CurrentCycle {
  date: string;
  macrocycle: Macrocycle | null;
  mesocycle: number | null;
  microcycle: number | null;
}

export type BlockMode = "COLLECTIVE" | "INDIVIDUAL" | "PAIRS";

export interface SessionBlock extends NamedItem {
  mode: BlockMode;
  /** Minutes after the class starts (collective blocks with a fixed time). */
  start_offset_minutes: number | null;
}

export type MetricGroup = "PHYSICAL" | "TECHNICAL";

export interface Metric extends NamedItem {
  group: MetricGroup;
}

export interface Assessment {
  id: number;
  student: number;
  metric: number;
  /** First day of the month. */
  period: string;
  score: number;
  notes: string;
  updated_at: string;
}

export interface CoachNote {
  id: number;
  student: number;
  body: string;
  visible_to_student: boolean;
  author_name: string;
  created_at: string;
}

export interface Homework {
  id: number;
  week_start: string;
  title: string;
  description: string;
  drill: number | null;
  drill_detail: Drill | null;
  is_broadcast: boolean;
  participants: number[];
  created_at: string;
}

export interface MyWeek {
  week_start: string;
  focus_text: string;
  homework: Omit<Homework, "participants">[];
  notes: CoachNote[];
}

export interface FighterClass extends NamedItem {
  description: string;
  emoji: string;
  /** Key of the artwork bundled with the frontend (see lib/fighterArt.ts); blank = emoji only. */
  art_key: string;
  /** Custom image uploaded by the coach; shown instead of the bundled art. */
  image_url: string | null;
}

export interface LeaderboardEntry {
  student: PublicUser;
  fighter_class: number | null;
  /** Classes with attendance taken where the student was marked present / not present. */
  attended: number;
  absences: number;
}

/** A strength or weakness the coach wrote for a student (free text, visible to the student). */
export interface StudentPoint {
  id: number;
  student: number;
  kind: "STRENGTH" | "WEAKNESS";
  text: string;
  created_at: string;
}

/** A day in the student calendar: published classes carry details; planned ones only date and time. */
export interface CalendarEntry {
  id: number | null;
  date: string;
  start_time: string | null;
  published: boolean;
  kind?: SessionKind;
  title?: string;
  notes?: string;
  checkin?: CheckInState;
  cancelled?: boolean;
  cancel_reason?: string;
}
