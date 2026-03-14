import DataTable, { type Column } from "../DataTable";
import type { CallQueue } from "../../types";

interface Props { data: CallQueue[]; }

const columns: Column<CallQueue>[] = [
  { key: "name",           label: "Nom" },
  { key: "language",       label: "Langue" },
  { key: "routingMethod",  label: "Méthode routage" },
  { key: "agentCount",     label: "Nb agents" },
  { key: "timeoutAction",  label: "Timeout" },
  { key: "overflowAction", label: "Overflow" },
  { key: "phoneNumber",    label: "Numéro" },
  {
    key: "canBeDeleted", label: "Supprimable ?",
    render: (v) => {
      const val = String(v);
      if (val === "Oui") {
        return <span className="badge badge-danger">Oui</span>;
      }
      if (val === "Non") {
        return <span className="badge badge-success">Non</span>;
      }
      return <span className="badge">{val || "—"}</span>;
    },
  },
];

export default function CallQueuesTab({ data }: Props) {
  return (
    <DataTable<CallQueue>
      columns={columns}
      data={data}
      exportFilename="call_queues.csv"
    />
  );
}
