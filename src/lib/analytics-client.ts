"use client";

// Browser-side analytics helpers. Events go to the GTM data layer only; GA4 and
// Meta Pixel tags are configured inside the existing GTM container and only
// load after the visitor gives consent. No personal data is pushed.

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type TrackEvent =
  | "project_view"
  | "category_browse"
  | "brochure_download"
  | "floor_plan_view"
  | "video_play"
  | "vr_start"
  | "chatbot_start"
  | "chatbot_handover"
  | "form_start"
  | "form_submit"
  | "generate_lead"
  | "whatsapp_click"
  | "call_click"
  | "pay_installment_click"
  | "payment_page_start"
  | "share";

export function track(event: TrackEvent, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
}

const ATTR_KEY = "pci_attribution";
const PARAMS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
  gclid: "gclid",
  fbclid: "fbclid",
} as const;

export interface Attribution {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  fbclid: string;
  landingPage: string;
  referrer: string;
}

const EMPTY: Attribution = { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "", gclid: "", fbclid: "", landingPage: "", referrer: "" };

/** Captures campaign parameters on the first page of a visit (or when new UTMs arrive). */
export function captureAttribution() {
  try {
    const url = new URL(window.location.href);
    const incoming: Partial<Attribution> = {};
    for (const [param, key] of Object.entries(PARAMS)) {
      const v = url.searchParams.get(param);
      if (v) incoming[key] = v.slice(0, 200);
    }
    const existing = sessionStorage.getItem(ATTR_KEY);
    if (!existing || Object.keys(incoming).length) {
      const external = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : "";
      const value: Attribution = { ...EMPTY, ...incoming, landingPage: url.pathname + url.search, referrer: external.slice(0, 500) };
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(value));
    }
  } catch {
    /* storage unavailable */
  }
}

export function getAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export const CONSENT_COOKIE = "pci_consent";
export type ConsentValue = "all" | "necessary";

export function readConsent(): ConsentValue | null {
  const match = document.cookie.match(/(?:^|; )pci_consent=(all|necessary)/);
  return (match?.[1] as ConsentValue) ?? null;
}

export function writeConsent(value: ConsentValue) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

const CONSENT_EVENT = "pci:consent";

/** useSyncExternalStore adapter for the consent cookie. "unknown" during SSR. */
export const consentStore = {
  subscribe(callback: () => void) {
    window.addEventListener(CONSENT_EVENT, callback);
    return () => window.removeEventListener(CONSENT_EVENT, callback);
  },
  getSnapshot: (): ConsentValue | "none" => readConsent() ?? "none",
  getServerSnapshot: (): "unknown" => "unknown",
};
