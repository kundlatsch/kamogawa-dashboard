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

export const isStaff = (user: User | null | undefined) =>
  user?.role === "ADMIN" || user?.role === "COACH";
