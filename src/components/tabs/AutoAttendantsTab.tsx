import DataTable, { type Column } from "../DataTable";
import type { AutoAttendant } from "../../types";

interface Props { data: AutoAttendant[]; }

const columns: Column<AutoAttendant>[] = [
  { key: "name",        label: "Nom" },
  { key: "timeZone",    label: "Fuseau horaire" },
  { key: "phoneNumber", label: "Numéro" },
  {
    key: "status",
    label: "Statut",
    render: (v) => <span className="badge badge-success">{String(v)}</span>,
  },
  {
    key: "canBeDeleted",
    label: "Supprimable ?",
    tooltip: "Oui uniquement si aucun numéro de téléphone n'est attribué ET aucun compte ressource n'est lié à ce standard automatique.",
    render: (v) => {
      const val = String(v);
      if (val === "Oui") return <span className="badge badge-danger">Oui</span>;
      if (val === "Non") return <span className="badge badge-success">Non</span>;
      return <span className="badge">{val || "—"}</span>;
    },
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
