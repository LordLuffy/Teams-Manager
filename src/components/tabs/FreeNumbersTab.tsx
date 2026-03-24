import DataTable, { type Column } from "../DataTable";
import type { FreeNumber } from "../../types";

interface Props { data: FreeNumber[]; }

const columns: Column<FreeNumber>[] = [
  { key: "number", label: "Numéro" },
  { key: "numberType", label: "Type" },
  { key: "capability", label: "Capacités" },
  { key: "status", label: "Statut", render: (v) => <span className="badge badge-success">{String(v)}</span> },
];

export default function FreeNumbersTab({ data }: Props) {
  return (
    <div>
      <div className="card" style={{ padding: "14px 18px", marginBottom: 18, display: "inline-flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="14" y2="21" />
          </svg>
        </div>
        <div>
          <p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>{data.length}</p>
          <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>numéro{data.length !== 1 ? "s" : ""} libre{data.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <DataTable<FreeNumber> columns={columns} data={data} exportFilename="numeros_libres.csv" />
    </div>
  );
}
