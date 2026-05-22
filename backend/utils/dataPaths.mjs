import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));
const seedDataDir = join(root, "backend", "data");
const runtimeDataDir = process.env.DATA_DIR || seedDataDir;

export function dataPath(filename) {
  return join(runtimeDataDir, filename);
}

export async function ensureDataFile(filename) {
  const targetPath = dataPath(filename);

  await mkdir(dirname(targetPath), { recursive: true });

  try {
    await access(targetPath, constants.F_OK);
  } catch {
    await copyFile(join(seedDataDir, filename), targetPath);
  }

  return targetPath;
}
