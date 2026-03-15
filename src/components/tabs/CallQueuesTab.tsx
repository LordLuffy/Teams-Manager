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
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Les <strong>files d'attente</strong> distribuent les appels entrants à un groupe d'agents selon une méthode de routage définie. Données récupérées via le module PowerShell <code style={{ fontSize: 11 }}>MicrosoftTeams</code> (<code style={{ fontSize: 11 }}>Get-CsCallQueue</code>).
        </p>
      </div>
      <DataTable<CallQueue>
        columns={columns}
        data={data}
        exportFilename="call_queues.csv"
      />
    </>
  );
}
