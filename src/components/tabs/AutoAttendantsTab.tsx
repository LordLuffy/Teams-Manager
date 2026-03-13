import DataTable, { type Column } from "../DataTable";
import type { AutoAttendant } from "../../types";

interface Props { data: AutoAttendant[]; }

const columns: Column<AutoAttendant>[] = [
  { key: "name",        label: "Nom" },
  { key: "language",    label: "Langue" },
  { key: "timeZone",    label: "Fuseau horaire" },
  { key: "phoneNumber", label: "Numéro" },
  {
    key: "status", label: "Statut",
    render: (v) => (
      <span className="badge badge-success">{String(v)}</span>
    ),
  },
];

export default function AutoAttendantsTab({ data }: Props) {
  return (
    <DataTable<AutoAttendant>
      columns={columns}
      data={data}
      exportFilename="auto_attendants.csv"
    />
  );
}
