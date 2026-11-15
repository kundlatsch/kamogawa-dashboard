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

export const isStaff = (user: User | null | undefined) =>
  user?.role === "ADMIN" || user?.role === "COACH";
