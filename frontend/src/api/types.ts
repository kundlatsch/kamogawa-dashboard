export type Role = "ADMIN" | "COACH" | "STUDENT";

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_emoji: string;
  color: string;
  role: Role;
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

export const isStaff = (user: User | null | undefined) =>
  user?.role === "ADMIN" || user?.role === "COACH";
