import { previewTimesheetFile } from "../src/features/ingestion/preview.ts";
import { buildCommitPayload } from "../src/features/ingestion/persist.ts";
import { parseParserTemplate } from "../src/features/ingestion/schemas.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function fileTypeFromName(fileName: string): "csv" | "xlsx" | "pdf" {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "pdf") {
    return ext;
  }
  throw new Error(`Unsupported file type: ${ext || "(none)"}`);
}

async function main() {
  const filePath = argValue("--file");
  const templatePath = argValue("--template");
  const clientId = argValue("--client-id") ?? "00000000-0000-0000-0000-000000000010";
  const staffingCompany = (argValue("--staffing-company") ?? "AH") as "AH" | "SAH";

  if (!filePath) {
    throw new Error("Usage: --file <path> [--template <json>] [--client-id uuid] [--staffing-company AH|SAH]");
  }

  const template = templatePath
    ? parseParserTemplate(JSON.parse(await readFile(templatePath, "utf8")))
    : { ok: true as const, data: null };
  if (!template.ok) {
    throw new Error(template.error.message);
  }

  const preview = await previewTimesheetFile({
    file_name: path.basename(filePath),
    file_type: fileTypeFromName(filePath),
    file_path: filePath,
    client_id: clientId,
    staffing_company: staffingCompany,
    template: template.data,
  });

  const commit = buildCommitPayload(
    { client_id: clientId, staffing_company: staffingCompany, template: template.data },
    preview,
  );

  process.stdout.write(`${JSON.stringify({ preview, commit_payload: commit }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
