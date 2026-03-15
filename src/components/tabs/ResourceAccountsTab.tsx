import DataTable, { type Column } from "../DataTable";
import type { ResourceAccount } from "../../types";

interface Props { data: ResourceAccount[]; }

function typeBadge(v: unknown) {
  const s = String(v);
  if (s === "Call Queue")     return <span className="badge badge-info">File d'attente</span>;
  if (s === "Auto Attendant") return <span className="badge badge-info">Standard automatique</span>;
  return <span className="badge badge-neutral">{s}</span>;
}

const columns: Column<ResourceAccount>[] = [
  { key: "displayName", label: "Nom affiché" },
  { key: "upn",         label: "UPN" },
  { key: "accountType", label: "Type", render: typeBadge },
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
    <DataTable<ResourceAccount>
      columns={columns}
      data={data}
      exportFilename="comptes_ressources.csv"
    />
  );
}
