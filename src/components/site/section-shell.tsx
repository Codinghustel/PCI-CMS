import { cn } from "@/lib/utils";

export type SectionBackground = "default" | "muted" | "dark";

/** Consistent vertical rhythm and background handling for page sections. */
export function SectionShell({
  background = "default",
  className,
  children,
  id,
  as: Tag = "section",
}: {
  background?: SectionBackground | string;
  className?: string;
  children: React.ReactNode;
  id?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "section-y",
        background === "muted" && "bg-muted",
        background === "dark" && "on-dark bg-dark text-dark-foreground",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  eyebrow,
  heading,
  intro,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2";
}) {
  if (!eyebrow && !heading && !intro) return null;
  return (
    <div className={cn("mb-10 max-w-3xl md:mb-14", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
      {heading ? <Tag className="text-4xl text-balance md:text-5xl">{heading}</Tag> : null}
      {intro ? <p className="mt-5 text-base leading-relaxed text-pretty opacity-80 md:text-lg">{intro}</p> : null}
    </div>
  );
}
