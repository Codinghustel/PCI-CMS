import { listPublishedProjects } from "@/server/public-data";
import { CONSTRUCTION_STATUSES, PROJECT_CATEGORIES, type ConstructionStatusValue, type ProjectCategoryValue } from "@/lib/content-labels";

/**
 * GET /api/v1/projects?category=RESIDENTIAL&status=ONGOING
 * Public, read-only list of published projects (for partners, the payment
 * service or future apps). Only published, approved marketing data is exposed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.toUpperCase();
  const status = url.searchParams.get("status")?.toUpperCase();
  const projects = await listPublishedProjects({
    category: (PROJECT_CATEGORIES as readonly string[]).includes(category ?? "") ? (category as ProjectCategoryValue) : undefined,
    status: (CONSTRUCTION_STATUSES as readonly string[]).includes(status ?? "") ? (status as ConstructionStatusValue) : undefined,
  });
  return Response.json({
    data: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      city: p.city,
      category: p.category,
      constructionStatus: p.constructionStatus,
      priceFrom: p.price,
      image: p.image ? { url: p.image.url, alt: p.image.alt } : null,
      url: `/projects/${p.slug}`,
    })),
  });
}
