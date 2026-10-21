import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLeadFields, createLead, findExistingLead, ORIGINATOR_ID, type LeadForCrm } from "@/server/integrations/bitrix24";
import { IntegrationError } from "@/server/integrations/http";
import { signPayload, startPaymentSession } from "@/server/integrations/payment-service";
import { decide, type RoutingIndex } from "@/server/routing-index";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

const lead: LeadForCrm = {
  correlationId: "c0ffee00-1111-2222-3333-444455556666",
  formType: "PROJECT_ENQUIRY",
  name: "Sara Khan",
  email: "sara@example.com",
  phone: "+923001234567",
  country: "Pakistan",
  message: "Interested in 2 bedrooms",
  projectName: "Grand Orchard",
  bitrixProjectId: "GO-01",
  pageUrl: "https://example.com/projects/grand-orchard",
  landingPage: "/projects/grand-orchard?utm_source=google",
  referrer: "https://google.com",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "launch",
  utmContent: "",
  utmTerm: "apartments",
  gclid: "abc",
  fbclid: "",
  consent: true,
  extra: { budget: "50M" },
  createdAt: new Date("2026-10-20T10:00:00Z"),
};
const config = { webhookUrl: "https://pci.bitrix24.com/rest/1/secret/", projectField: "UF_CRM_PROJECT", defaultAssigneeId: "7" };

afterEach(() => vi.unstubAllGlobals());

describe("Bitrix24 lead mapping", () => {
  it("maps contact, project, attribution and idempotency fields", () => {
    const f = buildLeadFields(lead, config);
    expect(f.NAME).toBe("Sara");
    expect(f.LAST_NAME).toBe("Khan");
    expect(f.PHONE).toEqual([{ VALUE: "+923001234567", VALUE_TYPE: "WORK" }]);
    expect(f.SOURCE_ID).toBe("WEB");
    expect(f.UTM_SOURCE).toBe("google");
    expect(f.UTM_TERM).toBe("apartments");
    expect(f.ORIGINATOR_ID).toBe(ORIGINATOR_ID);
    expect(f.ORIGIN_ID).toBe(lead.correlationId);
    expect(f.UF_CRM_PROJECT).toBe("GO-01");
    expect(f.ASSIGNED_BY_ID).toBe("7");
    expect(String(f.COMMENTS)).toContain("Project: Grand Orchard");
    expect(String(f.COMMENTS)).toContain("gclid: abc");
  });

  it("returns the new lead id on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: 4521 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createLead(config, lead)).resolves.toBe("4521");
    expect(fetchMock.mock.calls[0][0]).toBe("https://pci.bitrix24.com/rest/1/secret/crm.lead.add.json");
  });

  it("classifies rate limits and server errors as transient", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "QUERY_LIMIT_EXCEEDED" }), { status: 503 })));
    await expect(createLead(config, lead)).rejects.toMatchObject({ transient: true, httpStatus: 503 });
  });

  it("classifies validation errors as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "ERROR_CORE", error_description: "Invalid field" }), { status: 400 })));
    await expect(createLead(config, lead)).rejects.toMatchObject({ transient: false });
  });

  it("treats network failures as transient", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(createLead(config, lead)).rejects.toBeInstanceOf(IntegrationError);
  });

  it("finds already-delivered leads by correlation id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [{ ID: "99" }] }), { status: 200 })));
    await expect(findExistingLead(config, lead.correlationId)).resolves.toBe("99");
  });
});

describe("payment service client", () => {
  it("signs requests with HMAC and returns the redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sessionId: "s1", redirectUrl: "https://pay.example.com/s1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await startPaymentSession({ baseUrl: "https://pay.example.com", secret: "k" }, { bookingReference: "PCI-1", returnUrl: "https://x/status" });
    expect(res.redirectUrl).toBe("https://pay.example.com/s1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-PCI-Signature"]).toBe(signPayload("k", headers["X-PCI-Timestamp"], init.body as string));
  });
  it("refuses non-https redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ sessionId: "s1", redirectUrl: "http://pay.example.com/s1" }), { status: 200 })));
    await expect(startPaymentSession({ baseUrl: "https://pay.example.com", secret: "k" }, { bookingReference: "PCI-1", returnUrl: "https://x" })).rejects.toBeInstanceOf(IntegrationError);
  });
});

describe("proxy routing decisions", () => {
  const index: RoutingIndex = {
    loadedAt: Date.now(),
    redirects: new Map([["/about-us", { to: "/about", permanent: true }]]),
    pages: new Set(["about", "about/leadership", "home"]),
    projects: new Set(["grand-orchard"]),
    updates: new Set(),
    locations: new Set(),
    articles: new Set(["news-1"]),
    vacancies: new Set(),
  };
  it("redirects mapped legacy URLs (case/trailing slash insensitive)", () => {
    expect(decide("/About-Us/", index)).toEqual({ kind: "redirect", to: "/about", permanent: true });
  });
  it("passes live content and static routes", () => {
    expect(decide("/projects/grand-orchard", index).kind).toBe("pass");
    expect(decide("/about/leadership", index).kind).toBe("pass");
    expect(decide("/projects", index).kind).toBe("pass");
    expect(decide("/", index).kind).toBe("pass");
  });
  it("marks unknown or unpublished slugs as missing", () => {
    expect(decide("/projects/draft-project", index).kind).toBe("missing");
    expect(decide("/media/news-1/extra", index).kind).toBe("missing");
    expect(decide("/home", index).kind).toBe("missing");
    expect(decide("/no-such-page", index).kind).toBe("missing");
  });
});

describe("session tokens", () => {
  it("round-trips and rejects tampering", async () => {
    const abs = Math.floor(Date.now() / 1000) + 3600;
    const { token } = await signSessionToken({ userId: "u1", sessionId: "s1", absoluteExpiry: abs });
    expect((await verifySessionToken(token))?.sid).toBe("s1");
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "B" : "A") + token.slice(-1);
    expect(await verifySessionToken(tampered)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });
  it("never issues a token beyond the absolute session expiry", async () => {
    const abs = Math.floor(Date.now() / 1000) + 60;
    const { expiresAt } = await signSessionToken({ userId: "u1", sessionId: "s1", absoluteExpiry: abs });
    expect(Math.floor(expiresAt.getTime() / 1000)).toBe(abs);
  });
});

describe("redirect precedence (documented in the user guide)", () => {
  it("applies a redirect even when a published page exists at the same address", () => {
    const index: RoutingIndex = {
      loadedAt: Date.now(),
      redirects: new Map([["/about", { to: "/about-pci", permanent: true }]]),
      pages: new Set(["about"]),
      projects: new Set(),
      updates: new Set(),
      locations: new Set(),
      articles: new Set(),
      vacancies: new Set(),
    };
    expect(decide("/about", index)).toEqual({ kind: "redirect", to: "/about-pci", permanent: true });
  });
});
