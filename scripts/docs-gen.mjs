import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const roots = ["docs/components", "docs/decisions"];

async function listTxt(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const name of entries) {
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isFile() && name.endsWith(".txt")) {
      files.push(full);
    }
  }
  return files.sort();
}

const files = (await Promise.all(roots.map(listTxt))).flat();
if (files.length === 0) {
  console.error("docs:gen found no .txt files");
  process.exit(1);
}
console.log(`docs:gen ok (${files.length} files)`);
for (const file of files) {
  console.log(` - ${file}`);
}
