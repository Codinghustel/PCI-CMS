import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { TAGS, type CacheTag } from "@/lib/cache-tags";

/**
 * Expires public cache entries after a CMS change. Server Actions use
 * updateTag (read-your-own-writes: the editor and the next visitor see the
 * change immediately, and unpublished content disappears at once).
 */
export function refreshPublic(...tags: CacheTag[]) {
  for (const tag of new Set<CacheTag>(tags.length ? tags : [TAGS.site])) updateTag(tag);
}

/** Route Handler variant (updateTag is only available in Server Actions). */
export function refreshPublicFromRoute(...tags: CacheTag[]) {
  for (const tag of new Set<CacheTag>(tags.length ? tags : [TAGS.site])) revalidateTag(tag, { expire: 0 });
}
