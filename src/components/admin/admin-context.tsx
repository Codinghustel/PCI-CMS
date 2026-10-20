"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { can, type Actor, type Permission } from "@/lib/auth/permissions";
import type { MediaSummary } from "@/server/services/media";

// Client-side CMS context: the signed-in actor (for showing/hiding controls —
// the server still enforces every permission), a registry of media items that
// forms reference by id, and project options for project pickers.

interface AdminContextValue {
  actor: Actor;
  can: (permission: Permission) => boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const value = useMemo(() => ({ actor, can: (p: Permission) => can(actor, p) }), [actor]);
  return <AdminContext value={value}>{children}</AdminContext>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

interface MediaRegistryValue {
  get: (id: string | null | undefined) => MediaSummary | undefined;
  register: (items: MediaSummary[]) => void;
}

const MediaRegistryContext = createContext<MediaRegistryValue | null>(null);

export function MediaRegistryProvider({ initial, children }: { initial: MediaSummary[]; children: React.ReactNode }) {
  const [items, setItems] = useState(() => new Map(initial.map((m) => [m.id, m])));
  const register = useCallback((list: MediaSummary[]) => {
    setItems((prev) => {
      const next = new Map(prev);
      for (const m of list) next.set(m.id, m);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ get: (id: string | null | undefined) => (id ? items.get(id) : undefined), register }), [items, register]);
  return <MediaRegistryContext value={value}>{children}</MediaRegistryContext>;
}

export function useMediaRegistry() {
  const ctx = useContext(MediaRegistryContext);
  if (!ctx) throw new Error("useMediaRegistry must be used inside MediaRegistryProvider");
  return ctx;
}

export interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

const ProjectOptionsContext = createContext<ProjectOption[]>([]);

export function ProjectOptionsProvider({ options, children }: { options: ProjectOption[]; children: React.ReactNode }) {
  return <ProjectOptionsContext value={options}>{children}</ProjectOptionsContext>;
}

export function useProjectOptions() {
  return useContext(ProjectOptionsContext);
}
