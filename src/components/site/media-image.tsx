import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import type { PublicMedia } from "@/server/public-data";

type Props = Omit<ImageProps, "src" | "alt" | "width" | "height"> & {
  media: PublicMedia | null | undefined;
  alt?: string;
  fill?: boolean;
  fallbackClassName?: string;
};

/** next/image for CMS media, with a branded placeholder when no image is set. */
export function MediaImage({ media, alt, fill, className, fallbackClassName, sizes, ...rest }: Props) {
  if (!media) {
    return (
      <div
        aria-hidden
        className={cn(
          "bg-[linear-gradient(135deg,var(--primary),var(--dark))]",
          fill ? "absolute inset-0" : "aspect-[4/3] w-full",
          fallbackClassName
        )}
      />
    );
  }
  const altText = alt ?? media.alt ?? "";
  if (fill || !media.width || !media.height) {
    return <Image src={media.url} alt={altText} fill sizes={sizes ?? "100vw"} className={cn("object-cover", className)} {...rest} />;
  }
  return (
    <Image
      src={media.url}
      alt={altText}
      width={media.width}
      height={media.height}
      sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"}
      className={className}
      {...rest}
    />
  );
}
