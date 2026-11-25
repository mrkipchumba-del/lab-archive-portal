"use client";

import React, { useMemo, useState } from "react";
import type { LabRecord } from "@/lib/sheet-catalog";

function toPreviewUrl(url: string): string {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1]
    ? `https://drive.google.com/file/d/${match[1]}/preview`
    : url;
}

function getFileIcon(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "📕";
  if (clean.endsWith(".doc") || clean.endsWith(".docx")) return "📘";
  if (clean.endsWith(".csv") || clean.endsWith(".xls") || clean.endsWith(".xlsx"))
    return "📗";
  if (clean.endsWith(".json")) return "🧾";
  return "⚛️";
}

export default function ArchiveClient({
  records,
  error,
}: {
  records: LabRecord[];
  error?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("ALL");
  const [previewItem, setPreviewItem] = useState<LabRecord | null>(null);

  const folders = useMemo(() => {
    const unique = new Set<string>();
    records.forEach((r) => unique.add(r.folder || "Uncategorized"));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const groupedRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return folders
      .filter((folder) => selectedFolder === "ALL" || folder === selectedFolder)
      .map((folder) => {
        const folderMatches = term ? folder.toLowerCase().includes(term) : false;

        const matchingItems = records.filter((item) => {
          const inFolder = (item.folder || "Uncategorized") === folder;
          if (!inFolder) return false;
          if (!term) return true;

          return (
            folderMatches ||
            item.title.toLowerCase().includes(term) ||
            item.notes.toLowerCase().includes(term) ||
            item.date.toLowerCase().includes(term) ||
            item.tags.some((t) => t.toLowerCase().includes(term))
          );
        });

        return {
          folder,
          items: matchingItems,
          visible: !term || folderMatches || matchingItems.length > 0,
        };
      })
      .filter((group) => group.visible);
  }, [folders, records, searchTerm, selectedFolder]);

  function handleExportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lab-archive-snapshot-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="brand">
          <span>⚛️</span>
          <span>Personal Lab Archive</span>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleExportJson}
        >
          💾 Export JSON
        </button>
      </header>

      <main className="portal-main">
        {error && (
          <div className="alert-error">
            <strong>Sheet Notice:</strong> {error}
          </div>
        )}

        <section className="controls">
          <input
            type="search"
            className="search-input"
            placeholder="🔍 Search title, tags, notes, folder, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="filter-select"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
          >
            <option value="ALL">All Folders</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        </section>

        <section className="folder-list">
          {groupedRecords.length === 0 ? (
            <p className="empty-state">
              {records.length === 0
                ? "No lab records found yet. Add rows to your Lab-Archive-Index Google Sheet."
                : "No records match your current search or folder filter."}
            </p>
          ) : (
            groupedRecords.map(({ folder, items }) => (
              <details key={folder} className="folder-group" open>
                <summary className="folder-summary">
                  <span>📁</span>
                  <span className="folder-name">{folder}</span>
                  <span className="badge">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </summary>

                <div className="doc-grid">
                  {items.map((item, idx) => (
                    <article key={`${item.title}-${idx}`} className="doc-card">
                      <div>
                        <div className="doc-thumbnail">
                          <span>{getFileIcon(item.fileUrl)}</span>
                        </div>
                        <div className="doc-title">{item.title}</div>
                        {item.notes && <p className="doc-notes">{item.notes}</p>}
                        {item.tags.length > 0 && (
                          <div className="doc-tags">
                            {item.tags.map((tag) => (
                              <span key={tag} className="tag-chip">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.date && (
                          <div className="doc-meta">Date: {item.date}</div>
                        )}
                      </div>

                      <div className="card-actions">
                        {item.fileUrl && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setPreviewItem(item)}
                            >
                              👁️ Preview
                            </button>
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline"
                            >
                              ⬇️ Open File
                            </a>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            ))
          )}
        </section>
      </main>

      {previewItem && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="modal-content modal-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <div>
                <h3>{previewItem.title}</h3>
                {previewItem.notes && (
                  <p className="muted-text">{previewItem.notes}</p>
                )}
              </div>
              <div className="preview-actions">
                <a
                  href={previewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  ↗ Open in Tab
                </a>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPreviewItem(null)}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <iframe
              src={toPreviewUrl(previewItem.fileUrl)}
              title={previewItem.title}
              className="preview-frame"
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </div>
  );
}