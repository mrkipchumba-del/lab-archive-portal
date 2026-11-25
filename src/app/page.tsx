import { Suspense } from "react";
import { fetchCatalogFromSheet } from "@/lib/sheet-catalog";
import ArchiveClient from "@/components/ArchiveClient";

async function CatalogContent() {
  const { records, error } = await fetchCatalogFromSheet();
  return <ArchiveClient records={records} error={error} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="portal-shell">
          <main className="portal-main">
            <p className="empty-state">Loading Lab Archive...</p>
          </main>
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}