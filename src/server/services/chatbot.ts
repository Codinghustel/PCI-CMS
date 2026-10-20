import { z } from "zod";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/services/rate-limit";
import { parseInput } from "@/server/services/helpers";
import { CONSTRUCTION_STATUSES, MARKETS, PROJECT_CATEGORIES } from "@/lib/content-labels";

// Requirement-based project discovery ("Project Finder").
// Grounded, rule-based recommendations computed ONLY from published project
// records. It never invents prices, availability or returns: budget matching
// uses approved "price from" values only, and anything it cannot answer is
// handed over to Sales via the lead pipeline. The choice between this
// website-native assistant and a Bitrix24 bot remains an open ADR decision;
// this module is the integration point either way.

const answersSchema = z.object({
  market: z.enum([...MARKETS, "ANY"]).default("ANY"),
  category: z.enum([...PROJECT_CATEGORIES, "ANY"]).default("ANY"),
  status: z.enum([...CONSTRUCTION_STATUSES, "ANY"]).default("ANY"),
  budgetMax: z.coerce.number().min(0).max(1e12).optional(),
  currency: z.enum(["AED", "PKR", "USD", "CAD"]).optional(),
});
export type FinderAnswers = z.infer<typeof answersSchema>;

export interface FinderResult {
  id: string;
  name: string;
  slug: string;
  city: string;
  category: string;
  constructionStatus: string;
  imageKey: string | null;
  priceFrom: number | null;
  currency: string | null;
  reasons: string[];
}

export async function recommendProjects(input: unknown, meta: { ipAddress: string }) {
  await enforceRateLimit(`finder:${meta.ipAddress}`, 30, 10 * 60);
  const a = parseInput(answersSchema, input);
  const now = new Date();
  const projects = await db.project.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: now } },
    select: {
      id: true, name: true, slug: true, city: true, market: true, category: true, constructionStatus: true,
      priceFrom: true, currency: true, showPrice: true, commercialStatus: true, isFeatured: true,
      cardImage: { select: { storageKey: true } }, heroImage: { select: { storageKey: true } },
    },
  });

  const scored = projects
    .map((p): { score: number; result: FinderResult } | null => {
      let score = 0;
      const reasons: string[] = [];
      if (a.market !== "ANY") {
        if (p.market !== a.market) return null;
        score += 3;
        reasons.push(`Located in ${p.city}`);
      }
      if (a.category !== "ANY") {
        if (p.category === a.category) {
          score += 3;
          reasons.push("Matches the property type you chose");
        } else if (p.category === "MIXED_USE" && (a.category === "RESIDENTIAL" || a.category === "COMMERCIAL")) {
          score += 1;
          reasons.push("Mixed-use project including this type");
        } else return null;
      }
      if (a.status !== "ANY") {
        if (p.constructionStatus === a.status) {
          score += 2;
          reasons.push(a.status === "COMPLETED" ? "Ready / completed" : a.status === "ONGOING" ? "Under construction" : "Upcoming launch");
        } else score -= 1;
      }
      const priceVisible = p.showPrice && p.commercialStatus === "APPROVED" && p.priceFrom != null;
      if (a.budgetMax && a.currency) {
        if (priceVisible && p.currency === a.currency) {
          if (p.priceFrom! <= a.budgetMax) {
            score += 2;
            reasons.push("Starting price within your budget");
          } else return null;
        }
      }
      if (p.isFeatured) score += 0.5;
      return {
        score,
        result: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          city: p.city,
          category: p.category,
          constructionStatus: p.constructionStatus,
          imageKey: p.cardImage?.storageKey ?? p.heroImage?.storageKey ?? null,
          priceFrom: priceVisible ? p.priceFrom : null,
          currency: priceVisible ? p.currency : null,
          reasons,
        },
      };
    })
    .filter((x) => x !== null)
    .sort((x, y) => y.score - x.score)
    .slice(0, 4);

  return { results: scored.map((s) => s.result), handoverSuggested: scored.length === 0 };
}
