import DataTable, { type Column } from "../DataTable";
import type { OrphanLicense } from "../../types";

interface Props { data: OrphanLicense[]; }

const columns: Column<OrphanLicense>[] = [
  { key: "displayName", label: "Nom" },
  { key: "upn",         label: "UPN" },
  { key: "licenses",    label: "Licences" },
  {
    key: "status", label: "Statut",
    render: (v) => (
      <span className="badge badge-warning">{String(v)}</span>
    ),
  },
];

export default function OrphanLicensesTab({ data }: Props) {
  return (
    <div>
      {/* Alert banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        background: "var(--warning-bg)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 8, padding: "12px 16px", marginBottom: 18,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9"  x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p style={{ color: "var(--warning)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Ces utilisateurs ont une licence Teams Phone mais <strong>aucun numéro Teams détecté</strong>.
          La détection repose maintenant sur l'inventaire Teams des affectations de numéros, avec repli limité si nécessaire.
        </p>
      </div>

      <DataTable<OrphanLicense>
        columns={columns}
        data={data}
        exportFilename="licences_orphelines.csv"
      />
    </div>
  );
}
