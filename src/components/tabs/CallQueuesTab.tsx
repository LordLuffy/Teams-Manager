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

function AgentDetail({ row }: { row: CallQueue }) {
  const hasAgents = row.agents && row.agents.length > 0;
  const hasDists  = row.distributionLists && row.distributionLists.length > 0;

  if (!hasAgents && !hasDists) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>
        Aucun agent individuel ni groupe de distribution configuré.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hasAgents && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(96,165,250,0.05)", borderLeft: "3px solid rgba(96,165,250,0.4)" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.03em" }}>
            AGENTS INDIVIDUELS ({row.agents.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {row.agents.map((a, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", padding: "2px 9px",
                borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: "rgba(96,165,250,0.1)", color: "#60a5fa",
                border: "1px solid rgba(96,165,250,0.25)",
              }}>{a}</span>
            ))}
          </div>
        </div>
      )}
      {hasDists && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(167,139,250,0.05)", borderLeft: "3px solid rgba(167,139,250,0.4)" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.03em" }}>
            GROUPES DE DISTRIBUTION ({row.distributionLists.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {row.distributionLists.map((dl, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", padding: "2px 9px",
                borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: "rgba(167,139,250,0.1)", color: "#a78bfa",
                border: "1px solid rgba(167,139,250,0.25)",
              }} title={dl}>
                {dl.length > 40 ? dl.slice(0, 39) + "…" : dl}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallQueuesTab({ data }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Les <strong>files d'attente</strong> distribuent les appels entrants à un groupe d'agents selon une méthode de routage définie.
          Cliquez sur <strong>▶</strong> pour afficher les agents de chaque file. Données via <code style={{ fontSize: 11 }}>Get-CsCallQueue</code>.
        </p>
      </div>
      <DataTable<CallQueue>
        columns={columns}
        data={data}
        exportFilename="call_queues.csv"
        expandRow={(row) => <AgentDetail row={row} />}
      />
    </>
  );
}
