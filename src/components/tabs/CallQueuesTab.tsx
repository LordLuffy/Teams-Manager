import DataTable, { type Column } from "../DataTable";
import type { CallQueue } from "../../types";
import { useI18n } from "../../i18n";

interface Props { data: CallQueue[]; }

function AgentDetail({ row, t }: { row: CallQueue; t: (k: string) => string }) {
  const hasAgents = row.agents && row.agents.length > 0;
  const hasDists  = row.distributionLists && row.distributionLists.length > 0;

  if (!hasAgents && !hasDists) {
    return <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>{t("tabs.callQueues.noAgents")}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hasAgents && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(96,165,250,0.05)", borderLeft: "3px solid rgba(96,165,250,0.4)" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.03em" }}>
            {t("tabs.callQueues.agentsLabel")} ({row.agents.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {row.agents.map((a, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>{a}</span>
            ))}
          </div>
        </div>
      )}
      {hasDists && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(167,139,250,0.05)", borderLeft: "3px solid rgba(167,139,250,0.4)" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.03em" }}>
            {t("tabs.callQueues.groupsLabel")} ({row.distributionLists.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {row.distributionLists.map((dl, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }} title={dl}>
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
  const { t } = useI18n();

  const columns: Column<CallQueue>[] = [
    { key: "name",          label: t("tabs.callQueues.name") },
    { key: "routingMethod", label: t("tabs.callQueues.routing") },
    { key: "agentCount",    label: t("tabs.callQueues.agents") },
    { key: "timeoutAction",  label: t("tabs.callQueues.timeout"),  tooltip: t("tabs.callQueues.timeoutTooltip") },
    { key: "overflowAction", label: t("tabs.callQueues.overflow"), tooltip: t("tabs.callQueues.overflowTooltip") },
    { key: "phoneNumber",    label: t("tabs.callQueues.phone") },
    {
      key: "canBeDeleted",
      label: t("tabs.callQueues.deletable"),
      tooltip: t("tabs.callQueues.deletableTooltip"),
      render: (v) => {
        const val = String(v);
        const isYes = val === "Oui" || val === "true";
        if (isYes) return <span className="badge badge-danger">{t("common.yes")}</span>;
        if (val === "Non" || val === "false") return <span className="badge badge-success">{t("common.no")}</span>;
        return <span className="badge">{val || "—"}</span>;
      },
    },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: t("tabs.callQueues.infoDesc") }} />
      </div>
      <DataTable<CallQueue>
        columns={columns}
        data={data}
        exportFilename="call_queues.csv"
        expandRow={(row) => <AgentDetail row={row} t={t} />}
      />
    </>
  );
}
