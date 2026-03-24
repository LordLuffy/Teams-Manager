import DataTable, { type Column } from "../DataTable";
import type { ResourceAccount } from "../../types";

interface Props { data: ResourceAccount[]; }

const columns: Column<ResourceAccount>[] = [
  { key: "displayName", label: "Nom affiché" },
  { key: "upn",         label: "UPN" },
  { key: "phoneNumber", label: "Numéro" },
  {
    key: "licensed",
    label: "Licencié",
    tooltip: "Indique si ce compte ressource possède une licence Teams Phone Resource Account. Cette licence est obligatoire pour lui affecter un numéro de téléphone PSTN.",
    render: (v) => (
      <span className={`badge ${v === "Oui" ? "badge-success" : "badge-neutral"}`}>
        {String(v)}
      </span>
    ),
  },
];

export default function ResourceAccountsTab({ data }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Les <strong>comptes ressources</strong> sont des identités virtuelles (non-humaines) auxquelles on peut attribuer un numéro PSTN. Chaque compte est lié à une file d'attente ou un standard automatique. Une licence <em>Teams Phone Resource Account</em> est nécessaire pour l'attribution d'un numéro.
        </p>
      </div>
      <DataTable<ResourceAccount>
        columns={columns}
        data={data}
        exportFilename="comptes_ressources.csv"
      />
    </>
  );
}
