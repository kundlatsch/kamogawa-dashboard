export type Role = "ACCOUNT_ADMIN" | "COACH" | "STUDENT";

export interface GymSummary {
  id: number;
  name: string;
  slug: string;
  /** Accent color of the student area. */
  color: string;
}

export interface Gym extends GymSummary {
  is_active: boolean;
  created_at: string;
  coach_count: number;
  student_count: number;
}

export type Handedness = "UNSPECIFIED" | "RIGHT" | "LEFT";

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  color: string;
  handedness: Handedness;
  limitations: string;
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
}

export type SessionKind = "REGULAR" | "EXTRA" | "SPARRING";
export type SessionStatus = "DRAFT" | "PUBLISHED";

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

export interface MyRoutine {
  date: string;
  sessions: (SessionSummary & { objective: string; routine: RoutineItem[] })[];
}

export interface AppNotification {
  id: number;
  kind: "SESSION_PUBLISHED" | "SPARRING";
  session: SessionSummary | null;
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

export interface WeeklyFocus {
  id: number;
  student: number;
  week_start: string;
  position: 1 | 2;
  focus: number;
  focus_detail: NamedItem;
  note: string;
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
  focuses: WeeklyFocus[];
  homework: Omit<Homework, "participants">[];
  notes: CoachNote[];
}
