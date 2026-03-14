import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Column<T> {
  key: string;
  label: string;
  render?: (val: unknown, row: T) => React.ReactNode;
}

interface Props<T extends object> {
  columns: Column<T>[];
  data: T[] | null;
  exportFilename: string;
}

const PAGE_SIZE = 50;

export default function DataTable<T extends object>({ columns, data, exportFilename }: Props<T>) {
  const defaultSortKey = columns[0]?.key ?? null;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSortKey(defaultSortKey);
    setSortAsc(true);
  }, [defaultSortKey]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter((row) => Object.values(row as Record<string, unknown>).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [data, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = String(a[sortKey as keyof T] ?? "");
      const vb = String(b[sortKey as keyof T] ?? "");
      return sortAsc
        ? va.localeCompare(vb, "fr", { sensitivity: "base", numeric: true })
        : vb.localeCompare(va, "fr", { sensitivity: "base", numeric: true });
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(1);
  }

  async function handleExport() {
    const headers = columns.map((c) => c.label);
    const rows = sorted.map((row) => columns.map((c) => String(row[c.key as keyof T] ?? "")));
    try {
      await invoke("export_csv", { headers, rows, filename: exportFilename });
    } catch (error) {
      await invoke("log_frontend_error", {
        context: "export CSV",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  }

  if (data === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 36 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-3)"
            strokeWidth="2"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input"
            style={{ paddingLeft: 32, maxWidth: 320 }}
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <span style={{ color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={handleExport}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {data.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Aucune donnée</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Aucun résultat pour «{search}»</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} onClick={() => handleSort(col.key)}>
                      {col.label}
                      {sortKey === col.key && <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortAsc ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, ri) => (
                  <tr key={ri}>
                    {columns.map((col) => (
                      <td key={col.key} title={String(row[col.key as keyof T] ?? "")}>
                        {col.render ? col.render(row[col.key as keyof T], row) : String(row[col.key as keyof T] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
          <span style={{ color: "var(--text-3)", fontSize: 12 }}>Page {page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Précédent</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Suivant</button>
        </div>
      )}
    </div>
  );
}
