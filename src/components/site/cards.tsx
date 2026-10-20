import Link from "next/link";
import { ArrowUpRight, Calendar, MapPin } from "lucide-react";
import { MediaImage } from "@/components/site/media-image";
import {
  ARTICLE_CATEGORY_LABELS,
  CONSTRUCTION_STATUS_LABELS,
  PROJECT_CATEGORY_LABELS,
  type ArticleCategoryValue,
} from "@/lib/content-labels";
import { formatDate, formatPrice } from "@/lib/text";
import type { ProjectCardData, PublicMedia } from "@/server/public-data";

export function ProjectCard({ project, priority }: { project: ProjectCardData; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col overflow-hidden bg-card text-card-foreground shadow-sm ring-1 ring-border transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        <MediaImage
          media={project.image}
          alt={project.image?.alt || project.name}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute start-4 top-4 flex flex-wrap gap-2">
          <span className="bg-background/90 px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.18em] text-primary uppercase backdrop-blur">
            {CONSTRUCTION_STATUS_LABELS[project.constructionStatus]}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow mb-2">{PROJECT_CATEGORY_LABELS[project.category]}</p>
        <h3 className="text-2xl">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {project.name}
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {project.address || project.city}
        </p>
        {project.facts.length || project.price ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            {project.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
            {project.price ? (
              <div>
                <dt className="text-xs text-muted-foreground">Starting from</dt>
                <dd className="font-medium">{formatPrice(project.price.amount, project.price.currency)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          View project <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </article>
  );
}

export interface UpdateCardData {
  title: string;
  slug: string;
  date: Date;
  summary: string;
  progressPercent: number | null;
  image: PublicMedia | null;
  project: { name: string; slug: string };
  youtubeId?: string;
}

export function UpdateCard({ update }: { update: UpdateCardData }) {
  return (
    <article className="group relative flex flex-col overflow-hidden bg-card text-card-foreground ring-1 ring-border">
      <div className="relative aspect-video overflow-hidden">
        <MediaImage media={update.image} alt={update.image?.alt || update.title} fill sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
        {update.progressPercent != null ? (
          <span className="absolute end-3 bottom-3 bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
            {update.progressPercent}% complete
          </span>
        ) : null}
        {update.youtubeId ? (
          <span className="absolute start-3 bottom-3 bg-black/70 px-2 py-1 text-[0.65rem] font-semibold tracking-wider text-white uppercase">Video</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow mb-2">{update.project.name}</p>
        <h3 className="text-xl">
          <Link href={`/project-updates/${update.slug}`} className="after:absolute after:inset-0">
            {update.title}
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" aria-hidden />
          <time dateTime={new Date(update.date).toISOString()}>{formatDate(update.date, "month")}</time>
        </p>
        {update.summary ? <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{update.summary}</p> : null}
      </div>
    </article>
  );
}

export interface ArticleCardData {
  title: string;
  slug: string;
  category: ArticleCategoryValue;
  excerpt: string;
  publishedAt: Date | null;
  eventDate: Date | null;
  coverImage: PublicMedia | null;
}

export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[3/2] overflow-hidden">
        <MediaImage media={article.coverImage} alt={article.coverImage?.alt || article.title} fill sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="pt-5">
        <p className="eyebrow mb-2">
          {ARTICLE_CATEGORY_LABELS[article.category]}
          {article.publishedAt ? <span className="ms-2 text-muted-foreground">· {formatDate(article.publishedAt, "short")}</span> : null}
        </p>
        <h3 className="text-2xl leading-snug">
          <Link href={`/media/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p> : null}
      </div>
    </article>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg border border-dashed border-border px-6 py-16 text-center">
      <p className="heading text-2xl">{title}</p>
      {text ? <p className="mt-3 text-sm text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
