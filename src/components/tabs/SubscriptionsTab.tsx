import DataTable, { type Column } from "../DataTable";
import type { Subscription } from "../../types";

interface Props { data: Subscription[]; }

function statusBadge(status: string) {
  if (status === "OK") return <span className="badge badge-success">OK</span>;
  if (status === "SURPLUS") return <span className="badge badge-warning">Surplus</span>;
  if (status === "SURPLUS IMPORTANT") return <span className="badge badge-danger">Surplus important</span>;
  if (status === "DEPASSEMENT") return <span className="badge badge-danger">Dépassement</span>;
  return <span className="badge badge-neutral">{status}</span>;
}

function availableCell(v: unknown, row: Subscription) {
  const n = Number(v);
  const color = row.status === "OK" ? "var(--success)" : row.status === "SURPLUS" ? "var(--warning)" : "var(--danger)";
  return <span style={{ color, fontWeight: row.status === "OK" ? 500 : 700 }}>{n}</span>;
}

const columns: Column<Subscription>[] = [
  { key: "friendlyName", label: "Licence" },
  { key: "sku", label: "SKU" },
  { key: "purchased", label: "Payées" },
  { key: "suspended", label: "Suspendues" },
  { key: "consumed", label: "Consommées" },
  { key: "available", label: "Disponibles", render: availableCell },
  { key: "status", label: "Statut", render: (v) => statusBadge(String(v)) },
];

export default function SubscriptionsTab({ data }: Props) {
  const totalConsumed = data.reduce((sum, s) => sum + s.consumed, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          </div>
          <div><p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>{data.length}</p><p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>abonnements</p></div>
        </div>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
          </div>
          <div><p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>{totalConsumed.toLocaleString("fr-FR")}</p><p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>licences consommées</p></div>
        </div>
      </div>
      <div style={{ background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.2)", color: "var(--info)", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12, lineHeight: 1.6 }}>
        Pour les licences payantes : 0 à 1 disponible = vert, 2 à 4 = orange, au-delà = rouge. Les licences gratuites restent en vert tant qu'il n'y a pas de dépassement détecté.
      </div>
      <DataTable<Subscription> columns={columns} data={data} exportFilename="abonnements.csv" />
    </div>
  );
}
