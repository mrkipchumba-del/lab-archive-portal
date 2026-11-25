export interface LabRecord {
  title: string;
  folder: string;
  fileUrl: string;
  tags: string[];
  notes: string;
  date: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function fetchCatalogFromSheet(): Promise<{
  records: LabRecord[];
  error?: string;
}> {
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const tabName = (process.env.GOOGLE_SHEET_TAB || "Catalog").trim();

  if (!sheetId) {
    return {
      records: [],
      error: "GOOGLE_SHEET_ID is missing in .env.local",
    };
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    sheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  try {
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) {
      return {
        records: [],
        error: `Google Sheet request failed (${res.status}). Check that the sheet is shared as Viewer with link.`,
      };
    }

    const text = await res.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return { records: [] };
    }

    // Skip row 1 headers (Title, Folder, FileUrl, Tags, Notes, Date)
    const records: LabRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const title = cols[0] || "";
      const folder = cols[1] || "Uncategorized";
      const fileUrl = cols[2] || "";
      const rawTags = cols[3] || "";
      const notes = cols[4] || "";
      const date = cols[5] || "";

      if (!title && !fileUrl) continue;

      records.push({
        title: title || "Untitled Record",
        folder: folder || "Uncategorized",
        fileUrl,
        tags: rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
        date,
      });
    }

    return { records };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err.message : "Failed to fetch Google Sheet",
    };
  }
}