import { useQuery } from "@tanstack/react-query";

import { todayISO } from "../lib/dates";
import { api } from "./client";
import type {
  CurrentCycle,
  Drill,
  DrillCategory,
  Macrocycle,
  NamedItem,
  TrainingSession,
  User,
  WeeklySchedule,
} from "./types";

export const useSchedule = () =>
  useQuery({ queryKey: ["schedule"], queryFn: async () => (await api.get<WeeklySchedule>("/schedule/")).data });

/** Sessions in a date range; regular sessions are materialized from the schedule first (idempotent). */
export const useSessions = (from: string, to: string) =>
  useQuery({
    queryKey: ["sessions", from, to],
    queryFn: async () => {
      // Only fill in the future: past days without a session stay empty.
      const today = todayISO();
      if (to >= today) await api.post("/sessions/generate/", { from: from > today ? from : today, to });
      return (await api.get<TrainingSession[]>("/sessions/", { params: { from, to } })).data;
    },
  });

export const useDrills = () =>
  useQuery({ queryKey: ["drills"], queryFn: async () => (await api.get<Drill[]>("/drills/")).data });

export const useCategories = () =>
  useQuery({
    queryKey: ["drill-categories"],
    queryFn: async () => (await api.get<DrillCategory[]>("/drill-categories/")).data,
  });

export const useStudents = () =>
  useQuery({ queryKey: ["/students/"],queryFn: async () => (await api.get<User[]>("/students/")).data });

/** A coach-editable list such as "/valences/" or "/microcycle-phases/" (query key = the path). */
export const useNamedList = (path: string) =>
  useQuery({ queryKey: [path], queryFn: async () => (await api.get<NamedItem[]>(path)).data });

export const useMacrocycles = () =>
  useQuery({ queryKey: ["macrocycles"], queryFn: async () => (await api.get<Macrocycle[]>("/macrocycles/")).data });

export const useCurrentCycle = () =>
  useQuery({
    queryKey: ["macrocycles", "current"],
    queryFn: async () => (await api.get<CurrentCycle>("/cycles/current/")).data,
  });
