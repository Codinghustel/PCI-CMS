/**
 * Re-creates missing media-library files from the seed assets.
 *
 * For every Media row whose file is missing from UPLOAD_DIR and whose original
 * file exists in prisma/seed-assets, the asset is re-processed with the same
 * pipeline as an upload and written to the row's existing storage key, so all
 * URLs keep working. Database rows are not modified. Files uploaded through the
 * CMS (not from seed assets) cannot be recovered this way and are reported.
 *
 * Run: node --conditions=react-server --import tsx scripts/restore-media-files.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/server/db";
import { processImage } from "@/server/services/media";
import { publicStorage } from "@/server/integrations/storage";
import { detectFileType } from "@/lib/file-types";

const ASSETS = path.resolve("prisma/seed-assets");

async function main() {
  const rows = await db.media.findMany({ select: { storageKey: true, originalName: true } });
  let restored = 0;
  let present = 0;
  const unrecoverable: string[] = [];
  for (const row of rows) {
    if (await publicStorage().get(row.storageKey)) {
      present++;
      continue;
    }
    const source = path.join(ASSETS, row.originalName);
    if (!fs.existsSync(source)) {
      unrecoverable.push(row.originalName);
      continue;
    }
    const data = fs.readFileSync(source);
    const type = detectFileType(data);
    const out = type?.kind === "IMAGE" ? (await processImage(data, type)).data : data;
    await publicStorage().put(row.storageKey, out);
    restored++;
  }
  console.log(`Media files: ${restored} restored, ${present} already present, ${unrecoverable.length} unrecoverable.`);
  if (unrecoverable.length) console.log(unrecoverable.join("\n"));
}

main().finally(() => db.$disconnect());
