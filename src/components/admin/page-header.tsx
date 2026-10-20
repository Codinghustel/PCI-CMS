import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden /> {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** GET-based search/filter bar (works without JavaScript). */
export function ListToolbar({
  q,
  filters = [],
  placeholder = "Search…",
}: {
  q?: string;
  filters?: { name: string; value?: string; options: { value: string; label: string }[]; label: string }[];
  placeholder?: string;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
      <Input name="q" defaultValue={q} placeholder={placeholder} className="h-9 w-full max-w-xs" aria-label="Search" />
      {filters.map((f) => (
        <select
          key={f.name}
          name={f.name}
          defaultValue={f.value ?? ""}
          aria-label={f.label}
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">{f.label}: all</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      <Button type="submit" variant="secondary" size="sm" className="h-9">Apply</Button>
    </form>
  );
}

export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-4 text-xs text-muted-foreground">{total} item{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `?${sp}`;
  };
  const link = (p: number, disabled: boolean, children: React.ReactNode, label: string) =>
    disabled ? (
      <span className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/50" aria-hidden>{children}</span>
    ) : (
      <Link href={href(p)} aria-label={label} className="inline-flex size-8 items-center justify-center rounded-md border hover:bg-muted">{children}</Link>
    );
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <p className="text-xs text-muted-foreground">
        {total} items · page {page} of {pages}
      </p>
      <div className="flex items-center gap-1">
        {link(page - 1, page <= 1, <ChevronLeft className="size-4" />, "Previous page")}
        {link(page + 1, page >= pages, <ChevronRight className="size-4" />, "Next page")}
      </div>
    </nav>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("px-4 py-12 text-center text-sm text-muted-foreground")}>{children}</td>
    </tr>
  );
}
