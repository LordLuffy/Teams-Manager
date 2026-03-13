import DataTable, { type Column } from "../DataTable";
import type { UserLicense } from "../../types";

interface Props { data: UserLicense[]; }

const columns: Column<UserLicense>[] = [
  { key: "displayName",    label: "Nom" },
  { key: "upn",            label: "UPN" },
  { key: "skuPartNumber",  label: "SKU" },
  { key: "friendlyName",   label: "Licence" },
  {
    key: "accountEnabled", label: "Compte actif",
    render: (v) => (
      <span className={`badge ${v === "Oui" ? "badge-success" : "badge-danger"}`}>
        {String(v)}
      </span>
    ),
  },
];

export default function UserLicensesTab({ data }: Props) {
  return (
    <DataTable<UserLicense>
      columns={columns}
      data={data}
      exportFilename="licences_utilisateurs.csv"
    />
  );
}
