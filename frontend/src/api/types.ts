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
}

export interface Assignment {
  id: number;
  session: number;
  drill: number;
  drill_detail: Drill;
  participants: number[];
  is_broadcast: boolean;
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
  is_broadcast: boolean;
  order: number;
  notes: string;
  rounds: number | null;
  duration_minutes: number | null;
  partners: PublicUser[];
}

export interface MyRoutine {
  date: string;
  sessions: (SessionSummary & { routine: RoutineItem[] })[];
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
