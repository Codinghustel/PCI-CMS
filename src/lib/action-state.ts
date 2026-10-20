// Shape returned by every CMS Server Action, consumed by client forms.
export type ActionState<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
  | null;

export const initialActionState: ActionState = null;
