// Operational limits shared by the server code and the in-app user guide, so
// the guide can never describe a different number from the one enforced.
// Pure constants only (safe to import from client components).

/** Idle timeout: the session ends after this long without activity. */
export const SESSION_IDLE_SECONDS = 2 * 60 * 60;
/** Absolute session lifetime regardless of activity. */
export const SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;
/** The session is renewed on activity when less than this idle time remains. */
export const SESSION_RENEW_THRESHOLD_SECONDS = 60 * 60;

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const PASSWORD_MIN_LENGTH = 12;

/** Page versions kept in the History tab. */
export const MAX_PAGE_REVISIONS = 30;

export const MAX_IMAGE_MB = 15;
export const MAX_DOCUMENT_MB = 30;
export const MAX_CV_MB = 5;
/** Uploaded images are resized so neither side exceeds this many pixels. */
export const MAX_IMAGE_DIMENSION = 2560;

/** Automatic CRM delivery attempts for temporary failures (then manual re-send). */
export const MAX_CRM_ATTEMPTS = 6;
/** Wait before each automatic retry, in seconds. */
export const CRM_BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 3600, 6 * 3600, 12 * 3600];

/** Public content cache revalidation (scheduled items go live within this window). */
export const CONTENT_REVALIDATE_SECONDS = 300;

/** Maximum rows in one leads CSV export. */
export const MAX_LEAD_EXPORT_ROWS = 10_000;
