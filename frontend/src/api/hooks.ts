import { useQuery } from "@tanstack/react-query";

import { api } from "./client";
import type { Drill, DrillCategory, User } from "./types";

export const useDrills = () =>
  useQuery({ queryKey: ["drills"], queryFn: async () => (await api.get<Drill[]>("/drills/")).data });

export const useCategories = () =>
  useQuery({
    queryKey: ["drill-categories"],
    queryFn: async () => (await api.get<DrillCategory[]>("/drill-categories/")).data,
  });

export const useStudents = () =>
  useQuery({ queryKey: ["students"], queryFn: async () => (await api.get<User[]>("/students/")).data });
