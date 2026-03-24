import DataTable, { type Column } from "../DataTable";
import type { AutoAttendant } from "../../types";

interface Props { data: AutoAttendant[]; }

function ResourceAccountBadge({ row }: { row: AutoAttendant }) {
  const total     = row.resourceAccountCount ?? 0;
  const licensed  = row.resourceAccountLicensedCount ?? 0;
  const unlicensed = total - licensed;

  if (total === 0) return <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span className={`badge ${unlicensed > 0 ? "badge-warning" : "badge-success"}`}>{total}</span>
      {unlicensed > 0 && (
        <span style={{ color: "var(--accent-warn, #f59e0b)", fontSize: 11, whiteSpace: "nowrap" }}>
          {unlicensed} sans licence
        </span>
      )}
    </span>
  );
}

const columns: Column<AutoAttendant>[] = [
  { key: "name", label: "Nom" },
  {
    key: "resourceAccountCount",
    label: "Comptes ressources",
    tooltip: "Nombre de comptes ressources liés à ce standard automatique. Un compte sans licence Teams Phone Resource Account ne peut pas recevoir de numéro PSTN.",
    render: (_, row) => <ResourceAccountBadge row={row} />,
  },
  {
    key: "defaultCallFlow",
    label: "Flux d'appels",
    tooltip: "« Transférer → Compte ressource » redirige vers une autre file d'attente ou un autre standard automatique (scénario de routage interne). « Transférer → SharedVoicemail » envoie directement vers une boîte vocale partagée (fin de chaîne). Cliquez sur ▶ pour voir le détail complet du routage.",
  },
  { key: "phoneNumber", label: "Numéro" },
  {
    key: "status",
    label: "Statut",
    render: (v) => <span className="badge badge-success">{String(v)}</span>,
  },
];

function CallFlowDetail({ row }: { row: AutoAttendant }) {
  const df = row.defaultCallFlow?.trim();
  const ah = row.afterHoursCallFlow?.trim();
  const bh = row.businessHours ?? [];

  const hasFlows = (df && df !== "N/A") || (ah && ah !== "N/A");
  const hasHours = bh.length > 0;

  if (!hasFlows && !hasHours) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>
        Détails non disponibles (données PowerShell requises).
      </p>
    );
  }

  function flowLabel(flow: string) {
    return flow
      .replace("Transferer ->", "Transférer →")
      .replace("Deconnecter", "Déconnecter");
  }

  const weekOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const sorted = weekOrder
    .map((d) => bh.find((h) => h.day === d))
    .filter(Boolean) as typeof bh;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hasFlows && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(96,165,250,0.05)", borderLeft: "3px solid rgba(96,165,250,0.5)", minWidth: 160, flex: 1 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.03em" }}>
              FLUX — HEURES OUVRÉES
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-1)" }}>
              {df && df !== "N/A" ? flowLabel(df) : <span style={{ color: "var(--text-3)" }}>—</span>}
            </p>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(245,158,11,0.05)", borderLeft: "3px solid rgba(245,158,11,0.5)", minWidth: 160, flex: 1 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.03em" }}>
              FLUX — HORS HEURES OUVRÉES
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-1)" }}>
              {ah && ah !== "N/A" ? flowLabel(ah) : <span style={{ color: "var(--text-3)" }}>—</span>}
            </p>
          </div>
          {row.timeZone && row.timeZone !== "N/A" && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(148,163,184,0.05)", borderLeft: "3px solid rgba(148,163,184,0.35)", minWidth: 120 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.03em" }}>FUSEAU HORAIRE</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-1)" }}>{row.timeZone}</p>
            </div>
          )}
        </div>
      )}

      {hasHours && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(16,185,129,0.05)", borderLeft: "3px solid rgba(16,185,129,0.45)" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.03em" }}>
            HORAIRES D'OUVERTURE
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {sorted.map((dh) => {
              const closed = dh.hours === "Fermee" || dh.hours === "Fermée";
              return (
                <div
                  key={dh.day}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minWidth: 76,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: closed ? "var(--bg-secondary)" : "rgba(96,165,250,0.08)",
                    border: `1px solid ${closed ? "var(--border)" : "rgba(96,165,250,0.25)"}`,
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.04em" }}>
                    {dh.day.slice(0, 3).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: closed ? "var(--text-3)" : "var(--text-1)", whiteSpace: "nowrap" }}>
                    {closed ? "Fermé" : dh.hours}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AutoAttendantsTab({ data }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Les <strong>standards automatiques</strong> sont des menus vocaux interactifs (accueil, redirection, horaires…).
          Cliquez sur <strong>▶</strong> pour voir le détail du routage des appels. Données via <code style={{ fontSize: 11 }}>Get-CsAutoAttendant</code>.
        </p>
      </div>
      <DataTable<AutoAttendant>
        columns={columns}
        data={data}
        exportFilename="standards_automatiques.csv"
        expandRow={(row) => <CallFlowDetail row={row} />}
      />
    </>
  );
}
