import DataTable, { type Column } from "../DataTable";
import type { CallQueue } from "../../types";

interface Props { data: CallQueue[]; }

const columns: Column<CallQueue>[] = [
  { key: "name",          label: "Nom" },
  { key: "routingMethod", label: "Méthode de routage" },
  { key: "agentCount",    label: "Nb agents" },
  {
    key: "timeoutAction",
    label: "Expiration",
    tooltip: "Action effectuée lorsqu'un appel attend trop longtemps dans la file (délai d'attente dépassé).",
  },
  {
    key: "overflowAction",
    label: "Débordement",
    tooltip: "Action effectuée lorsque la file d'attente est pleine (nombre maximal d'appels en attente atteint).",
  },
  { key: "phoneNumber", label: "Numéro" },
  {
    key: "canBeDeleted",
    label: "Supprimable ?",
    tooltip: "Oui si la file n'a aucun agent assigné ET aucun numéro de téléphone attribué. Dans ce cas elle peut être supprimée sans impact.",
    render: (v) => {
      const val = String(v);
      if (val === "Oui") return <span className="badge badge-danger">Oui</span>;
      if (val === "Non") return <span className="badge badge-success">Non</span>;
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
