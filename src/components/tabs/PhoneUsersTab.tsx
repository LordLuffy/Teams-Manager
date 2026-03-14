import DataTable, { type Column } from "../DataTable";
import type { PhoneUser } from "../../types";

interface Props { data: PhoneUser[]; }

const badgeOuiNon = (value: unknown) => {
  const text = String(value);
  return <span className={`badge ${text === "Oui" ? "badge-success" : "badge-danger"}`}>{text}</span>;
};

const columns: Column<PhoneUser>[] = [
  { key: "displayName", label: "Nom" },
  { key: "upn", label: "UPN" },
  { key: "phoneNumber", label: "Numéro Teams" },
  { key: "evEnabled", label: "EV active", render: badgeOuiNon },
  { key: "accountEnabled", label: "Compte actif", render: badgeOuiNon },
  { key: "licenses", label: "Licences" },
];

export default function PhoneUsersTab({ data }: Props) {
  return <DataTable<PhoneUser> columns={columns} data={data} exportFilename="utilisateurs_avec_numero.csv" />;
}
