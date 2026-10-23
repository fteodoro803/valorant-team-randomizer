// Fails if something that looks like a Riot API key is in the page's source or build.
//
// Riot's policy says the key must never be in code or in anything shipped to players. This app
// is static, so anything in src, index.html or dist is public. A real key is the letters RGAPI,
// a dash, then a UUID. Matching that whole shape (not just "RGAPI-") keeps docs and comments
// that mention the prefix from tripping it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const KEY_SHAPE = /RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SCANNED = ["src", "public", "dist", "index.html"];
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf)$/i;

/** Every file under a path, or the path itself if it is a file. A missing path (no build yet) is skipped. */
function filesUnder(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => filesUnder(join(path, name)));
}

const hits = SCANNED.flatMap(filesUnder)
  .filter((file) => !BINARY.test(file))
  .filter((file) => KEY_SHAPE.test(readFileSync(file, "utf8")));

if (hits.length > 0) {
  console.error("Looks like a Riot API key in:\n" + hits.map((file) => `  ${file}`).join("\n"));
  console.error("Remove it and reset the key on the Riot developer portal.");
  process.exit(1);
}
