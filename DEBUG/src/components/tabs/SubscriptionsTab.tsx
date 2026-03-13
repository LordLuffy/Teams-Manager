import DataTable, { type Column } from "../DataTable";
import type { Subscription } from "../../types";

interface Props { data: Subscription[]; }

function statusBadge(status: string) {
  if (status === "OK")          return <span className="badge badge-success">{status}</span>;
  if (status === "EPUISE")      return <span className="badge badge-warning">{status}</span>;
  if (status === "DEPASSEMENT") return <span className="badge badge-danger">{status}</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

function availableCell(v: unknown) {
  const n = Number(v);
  const color = n < 0 ? "var(--danger)" : n <= 2 ? "var(--warning)" : "var(--text-2)";
  return <span style={{ color, fontWeight: n < 0 ? 600 : 400 }}>{n}</span>;
}

const columns: Column<Subscription>[] = [
  { key: "friendlyName", label: "Licence" },
  { key: "sku",          label: "SKU" },
  { key: "purchased",    label: "Payées" },
  { key: "suspended",    label: "Suspendues" },
  { key: "consumed",     label: "Consommées" },
  { key: "available",    label: "Disponibles", render: availableCell },
  { key: "status",       label: "Statut",      render: (v) => statusBadge(String(v)) },
];

export default function SubscriptionsTab({ data }: Props) {
  const totalConsumed = data.reduce((sum, s) => sum + s.consumed, 0);

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>
              {data.length}
            </p>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>abonnements</p>
          </div>
        </div>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4"  />
              <line x1="6"  y1="20" x2="6"  y2="14" />
            </svg>
          </div>
          <div>
            <p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>
              {totalConsumed.toLocaleString("fr-FR")}
            </p>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>licences consommées</p>
          </div>
        </div>
      </div>

      <DataTable<Subscription>
        columns={columns}
        data={data}
        exportFilename="abonnements.csv"
      />
    </div>
  );
}
