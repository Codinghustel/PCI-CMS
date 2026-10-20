// Application errors are framework-agnostic so services can be reused by a
// future standalone API. Route handlers and Server Actions translate them into
// HTTP responses / form state; unexpected errors are never exposed to clients.

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: FieldErrors;

  constructor(code: string, message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super("VALIDATION_ERROR", message, 422, fieldErrors);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super("CONFLICT", message, 409, fieldErrors);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Maps Prisma known request errors to application errors. */
export function mapPrismaError(error: unknown, uniqueFieldLabel?: Record<string, string>): never {
  const e = error as { code?: string; meta?: { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } };
  if (e?.code === "P2002") {
    const target =
      e.meta?.driverAdapterError?.cause?.constraint?.fields ??
      (Array.isArray(e.meta?.target) ? e.meta?.target : e.meta?.target ? [e.meta.target] : []);
    const field = (target ?? [])[0]?.replace(/"/g, "") ?? "value";
    const label = uniqueFieldLabel?.[field] ?? field;
    throw new ConflictError(`That ${label} is already in use.`, { [field]: [`This ${label} is already in use.`] });
  }
  if (e?.code === "P2003") {
    throw new ValidationError("A referenced record does not exist.");
  }
  if (e?.code === "P2025") {
    throw new NotFoundError();
  }
  throw error;
}
