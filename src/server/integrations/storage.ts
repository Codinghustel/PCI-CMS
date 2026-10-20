import fs from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/lib/env";

// File storage abstraction. The local-disk provider is used today; an object
// storage provider (S3, Azure Blob, …) can implement the same interface later
// without changing the media service.

export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes("..") && !key.includes("//");
}

class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, full);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string) {
    try {
      await fs.unlink(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}

let publicStore: StorageProvider | undefined;
let privateStore: StorageProvider | undefined;

/** Publicly served files (website media, brochures). */
export function publicStorage(): StorageProvider {
  return (publicStore ??= new LocalDiskStorage(serverEnv().UPLOAD_DIR));
}

/** Files that must never be publicly reachable (e.g. CVs). */
export function privateStorage(): StorageProvider {
  return (privateStore ??= new LocalDiskStorage(serverEnv().PRIVATE_UPLOAD_DIR));
}
