import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, "..", "dist");
const mobileWwwDir = path.resolve(__dirname, "..", "..", "mobile", "www");

async function ensureExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    throw new Error(`Diretorio nao encontrado: ${dir}`);
  }
}

async function recreateDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  await ensureExists(distDir);
  await recreateDir(mobileWwwDir);

  await fs.cp(distDir, mobileWwwDir, { recursive: true });
  console.log(`[cordova-sync] OK: ${distDir} -> ${mobileWwwDir}`);
}

main().catch((err) => {
  console.error(`[cordova-sync] ERRO: ${err.message}`);
  process.exit(1);
});
