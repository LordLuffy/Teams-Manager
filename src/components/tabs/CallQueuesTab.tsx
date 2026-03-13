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
