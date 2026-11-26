"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { LabRecord } from "@/lib/sheet-catalog";

type ViewDensity = "grid" | "compact";
type SortOption = "date-desc" | "date-asc" | "title-asc";

const VIEW_DENSITY_KEY = "lab_archive_view_density";
const SORT_OPTION_KEY = "lab_archive_sort_option";
const PRIVACY_SHIELD_KEY = "lab_archive_privacy_shield";
const RESTRICTED_TAGS = new Set(["private", "confidential", "draft", "internal"]);

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

function isRestrictedRecord(item: LabRecord): boolean {
  return item.tags.some((tag) => RESTRICTED_TAGS.has(tag.trim().toLowerCase()));
}

function parseDateValue(dateStr: string): number {
  if (!dateStr) return Number.NaN;
  const trimmed = dateStr.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    return Date.UTC(year, month, day);
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function compareRecords(a: LabRecord, b: LabRecord, sortBy: SortOption): number {
  if (sortBy === "title-asc") {
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }

  const timeA = parseDateValue(a.date);
  const timeB = parseDateValue(b.date);
  const validA = !Number.isNaN(timeA);
  const validB = !Number.isNaN(timeB);

  if (validA && !validB) return -1;
  if (!validA && validB) return 1;
  if (validA && validB && timeA !== timeB) {
    return sortBy === "date-desc" ? timeB - timeA : timeA - timeB;
  }

  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
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
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [previewItem, setPreviewItem] = useState<LabRecord | null>(null);
  const [viewDensity, setViewDensity] = useState<ViewDensity>("grid");
  const [privacyShield, setPrivacyShield] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [collapseResetKey, setCollapseResetKey] = useState(0);

  useEffect(() => {
    try {
      const savedDensity = window.localStorage.getItem(VIEW_DENSITY_KEY);
      if (savedDensity === "grid" || savedDensity === "compact") {
        setViewDensity(savedDensity);
      }

      const savedSort = window.localStorage.getItem(SORT_OPTION_KEY);
      if (
        savedSort === "date-desc" ||
        savedSort === "date-asc" ||
        savedSort === "title-asc"
      ) {
        setSortBy(savedSort);
      }

      const savedShield = window.localStorage.getItem(PRIVACY_SHIELD_KEY);
      if (savedShield === "true") {
        setPrivacyShield(true);
      }
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }, []);

  useEffect(() => {
    if (!previewItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewItem(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewItem]);

  function handleDensityChange(next: ViewDensity) {
    setViewDensity(next);
    try {
      window.localStorage.setItem(VIEW_DENSITY_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }

  function handleSortChange(next: SortOption) {
    setSortBy(next);
    try {
      window.localStorage.setItem(SORT_OPTION_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }

  function handlePrivacyToggle() {
    setPrivacyShield((prev) => {
      const next = !prev;
      if (next) {
        setPreviewItem(null);
      }
      try {
        window.localStorage.setItem(PRIVACY_SHIELD_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  function handleTagClick(tag: string) {
    const normalized = tag.toLowerCase();
    const tokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.includes(normalized)) {
      const remaining = tokens.filter((t) => t !== normalized).join(" ");
      setSearchTerm(remaining);
    } else {
      setSearchTerm(searchTerm.trim() ? `${searchTerm.trim()} ${tag}` : tag);
    }
  }

  const accessibleRecords = useMemo(
    () =>
      privacyShield
        ? records.filter((item) => !isRestrictedRecord(item))
        : records,
    [records, privacyShield]
  );

  const folders = useMemo(() => {
    const unique = new Set<string>();
    accessibleRecords.forEach((r) => unique.add(r.folder || "Uncategorized"));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [accessibleRecords]);

  const searchTokens = useMemo(
    () =>
      searchTerm
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [searchTerm]
  );

  const hasSearch = searchTokens.length > 0;

  const groupedRecords = useMemo(() => {
    return folders
      .filter((folder) => selectedFolder === "ALL" || folder === selectedFolder)
      .map((folder) => {
        const folderLower = folder.toLowerCase();
        const folderMatchesAllTokens = hasSearch
          ? searchTokens.every((token) => folderLower.includes(token))
          : false;

        const matchingItems = accessibleRecords
          .filter((item) => {
            const inFolder = (item.folder || "Uncategorized") === folder;
            if (!inFolder) return false;
            if (!hasSearch) return true;
            if (folderMatchesAllTokens) return true;

            const itemHaystack = [
              item.title,
              item.notes,
              item.date,
              item.folder,
              ...item.tags,
            ]
              .join(" ")
              .toLowerCase();

            return searchTokens.every((token) => itemHaystack.includes(token));
          })
          .sort((a, b) => compareRecords(a, b, sortBy));

        return {
          folder,
          items: matchingItems,
          visible: !hasSearch || folderMatchesAllTokens || matchingItems.length > 0,
        };
      })
      .filter((group) => group.visible);
  }, [folders, accessibleRecords, hasSearch, searchTokens, selectedFolder, sortBy]);

  const totalMatchingItems = useMemo(
    () => groupedRecords.reduce((sum, group) => sum + group.items.length, 0),
    [groupedRecords]
  );

  function setAllFoldersOpen(openState: boolean) {
    const nextState: Record<string, boolean> = {};
    groupedRecords.forEach(({ folder }) => {
      nextState[folder] = openState;
    });
    setExpandedFolders((prev) => ({ ...prev, ...nextState }));
    if (!openState) {
      setCollapseResetKey((k) => k + 1);
    }
  }

  function handleExportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      privacyShieldActive: privacyShield,
      totalRecords: accessibleRecords.length,
      records: accessibleRecords,
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

        <div className="header-actions">
          <div className="view-toggle" role="group" aria-label="Layout density">
            <button
              type="button"
              className={`btn btn-outline ${
                viewDensity === "grid" ? "btn-active" : ""
              }`}
              onClick={() => handleDensityChange("grid")}
              aria-pressed={viewDensity === "grid"}
            >
              Grid
            </button>
            <button
              type="button"
              className={`btn btn-outline ${
                viewDensity === "compact" ? "btn-active" : ""
              }`}
              onClick={() => handleDensityChange("compact")}
              aria-pressed={viewDensity === "compact"}
            >
              Compact
            </button>
          </div>

          <button
            type="button"
            className={`btn btn-outline ${privacyShield ? "btn-shield-active" : ""}`}
            onClick={handlePrivacyToggle}
            aria-pressed={privacyShield}
            title="Hide #private, #confidential, #draft, and #internal items"
          >
            {privacyShield ? "🛡️ Shield On" : "🔓 Shield Off"}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExportJson}
          >
            💾 Export JSON
          </button>
        </div>
      </header>

      <main className="portal-main">
        {error && (
          <div className="alert-error">
            <strong>Sheet Notice:</strong> {error}
          </div>
        )}

        {privacyShield && (
          <div className="privacy-banner" role="status">
            🛡️ <strong>Privacy Shield active:</strong> Items tagged{" "}
            <code>#private</code>, <code>#confidential</code>,{" "}
            <code>#draft</code>, or <code>#internal</code> are hidden from view
            and JSON exports.
          </div>
        )}

        <section className="controls">
          <input
            type="search"
            className="search-input"
            aria-label="Search lab records by keywords"
            placeholder="🔍 Search keywords (e.g. arduino manual, prism, 2026)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by folder"
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
          <select
            className="filter-select"
            aria-label="Sort lab records"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="title-asc">Title (A–Z)</option>
          </select>
        </section>

        <div className="results-bar">
          <span className="muted-text">
            {hasSearch || selectedFolder !== "ALL"
              ? `Showing ${totalMatchingItems} ${
                  totalMatchingItems === 1 ? "result" : "results"
                } across ${groupedRecords.length} ${
                  groupedRecords.length === 1 ? "folder" : "folders"
                }`
              : `${groupedRecords.length} ${
                  groupedRecords.length === 1 ? "folder" : "folders"
                } — tap a folder to view files`}
          </span>

          <div className="header-actions">
            {groupedRecords.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setAllFoldersOpen(true)}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setAllFoldersOpen(false)}
                >
                  Collapse All
                </button>
              </>
            )}
            {(hasSearch || selectedFolder !== "ALL") && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedFolder("ALL");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <section className="folder-list">
          {groupedRecords.length === 0 ? (
            <p className="empty-state">
              {records.length === 0
                ? "No lab records found yet. Add rows to your Lab-Archive-Index Google Sheet."
                : "No records match your current search, folder, or privacy filter."}
            </p>
          ) : (
            groupedRecords.map(({ folder, items }) => {
              const isOpen = hasSearch
                ? true
                : expandedFolders[folder] ?? false;

              return (
                <details
                  key={`${folder}-${collapseResetKey}`}
                  className="folder-group"
                  open={isOpen}
                  onToggle={(e) => {
                    if (hasSearch) return;
                    const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setExpandedFolders((prev) => ({
                      ...prev,
                      [folder]: nextOpen,
                    }));
                  }}
                >
                  <summary className="folder-summary">
                    <span>📁</span>
                    <span className="folder-name">{folder}</span>
                    <span className="badge">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </summary>

                  <div
                    className={`doc-grid ${
                      viewDensity === "compact" ? "doc-grid-compact" : ""
                    }`}
                  >
                    {items.map((item, idx) => (
                      <article
                        key={`${item.fileUrl || item.title}-${idx}`}
                        className="doc-card"
                      >
                        <div className="doc-body">
                          {viewDensity === "grid" && (
                            <div className="doc-thumbnail">
                              <span>{getFileIcon(item.fileUrl)}</span>
                            </div>
                          )}
                          <div className="doc-title">
                            {viewDensity === "compact" && (
                              <span style={{ marginRight: "0.45rem" }}>
                                {getFileIcon(item.fileUrl)}
                              </span>
                            )}
                            {item.title}
                          </div>
                          {item.notes && <p className="doc-notes">{item.notes}</p>}
                          {item.tags.length > 0 && (
                            <div className="doc-tags">
                              {item.tags.map((tag) => {
                                const activeTag = searchTokens.includes(
                                  tag.toLowerCase()
                                );
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    className={`tag-chip ${
                                      activeTag ? "tag-chip-active" : ""
                                    }`}
                                    onClick={() => handleTagClick(tag)}
                                    title={`Filter by #${tag}`}
                                  >
                                    #{tag}
                                  </button>
                                );
                              })}
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
                                referrerPolicy="no-referrer"
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
              );
            })
          )}
        </section>
      </main>

      {previewItem && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.title}
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="modal-content modal-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <div className="preview-title-wrap">
                <h3 className="doc-title">{previewItem.title}</h3>
                {previewItem.notes && (
                  <p className="muted-text doc-notes">{previewItem.notes}</p>
                )}
              </div>
              <div className="preview-actions">
                <a
                  href={previewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
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
              referrerPolicy="no-referrer"
              allow="autoplay"
            />
          </div>
        </div>
      )}
    </div>
  );
}