import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline" | "outline-light" | "ghost-light" | "link";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  outline: "border border-primary text-primary hover:bg-primary hover:text-primary-foreground",
  "outline-light": "border border-white/70 text-white hover:bg-white hover:text-primary",
  "ghost-light": "text-white hover:bg-white/10",
  link: "px-0! text-primary underline-offset-8 hover:underline",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.7rem]",
  md: "h-11 px-6 text-xs",
  lg: "h-13 px-8 text-xs",
};

export function siteButtonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "site-btn inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
    variants[variant],
    sizes[size],
    className
  );
}

type LinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function SiteButtonLink({ variant, size, className, ...props }: LinkProps) {
  return <Link className={siteButtonClass(variant, size, className)} {...props} />;
}

type ButtonProps = React.ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function SiteButton({ variant, size, className, ...props }: ButtonProps) {
  return <button className={siteButtonClass(variant, size, className)} {...props} />;
}
