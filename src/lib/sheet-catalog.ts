export interface LabRecord {
  title: string;
  folder: string;
  fileUrl: string;
  tags: string[];
  notes: string;
  date: string;
}

/**
 * Full RFC-4180 CSV parser that preserves newlines inside quoted cells
 * (e.g. multi-line Notes in Google Sheets).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i++;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
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
      error: "GOOGLE_SHEET_ID is missing in environment variables.",
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

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    // Google returns HTTP 200 with an HTML login page when sheet link-sharing is off
    if (
      contentType.includes("text/html") ||
      text.trimStart().toLowerCase().startsWith("<!doctype html") ||
      text.trimStart().toLowerCase().startsWith("<html")
    ) {
      return {
        records: [],
        error:
          "Google Sheet is restricted. Set sharing on Lab-Archive-Index to 'Anyone with the link → Viewer' (individual Drive files can remain restricted).",
      };
    }

    const rows = parseCsv(text);
    if (rows.length <= 1) {
      return { records: [] };
    }

    // Skip row 1 headers (Title, Folder, FileUrl, Tags, Notes, Date)
    const records: LabRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const title = cols[0] || "";
      const folder = cols[1] || "Uncategorized";
      const fileUrl = cols[2] || "";
      const rawTags = cols[3] || "";
      const notes = cols[4] || "";
      const date = cols[5] || "";

      if (!title && !fileUrl) continue;

      const uniqueTags = Array.from(
        new Set(
          rawTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        )
      );

      records.push({
        title: title || "Untitled Record",
        folder: folder || "Uncategorized",
        fileUrl,
        tags: uniqueTags,
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