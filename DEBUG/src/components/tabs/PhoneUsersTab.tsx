import DataTable, { type Column } from "../DataTable";
import type { PhoneUser } from "../../types";

interface Props { data: PhoneUser[]; }

const columns: Column<PhoneUser>[] = [
  { key: "displayName",    label: "Nom" },
  { key: "upn",            label: "UPN" },
  { key: "phoneNumber",    label: "Numéro Teams" },
  {
    key: "evEnabled", label: "EV Active",
    render: (v) => (
      <span className={`badge ${v === "Oui" ? "badge-success" : "badge-danger"}`}>
        {String(v)}
      </span>
    ),
  },
  {
    key: "accountEnabled", label: "Compte actif",
    render: (v) => (
      <span className={`badge ${v === "Oui" ? "badge-success" : "badge-danger"}`}>
        {String(v)}
      </span>
    ),
  },
  { key: "usageLocation", label: "Pays" },
  { key: "licenses",      label: "Licences" },
];

export default function PhoneUsersTab({ data }: Props) {
  return (
    <DataTable<PhoneUser>
      columns={columns}
      data={data}
      exportFilename="utilisateurs_avec_numero.csv"
    />
  );
}
