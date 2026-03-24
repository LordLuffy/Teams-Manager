import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import DataTable, { type Column } from "../DataTable";
import type { OrphanLicense, FreeNumber } from "../../types";
import { useI18n } from "../../i18n";

interface Props {
  data: OrphanLicense[];
  freeNumbers: FreeNumber[];
  onActionDone: () => void;
}

interface ActionState {
  loading: boolean;
  result: { ok: boolean; msg: string } | null;
}

export default function OrphanLicensesTab({ data, freeNumbers, onActionDone }: Props) {
  const { t } = useI18n();
  const [modalUser, setModalUser] = useState<OrphanLicense | null>(null);
  const [selectedNumber, setSelectedNumber] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [action, setAction] = useState<ActionState>({ loading: false, result: null });

  function openModal(row: OrphanLicense) {
    setModalUser(row);
    setSelectedNumber("");
    setSelectedType("");
    setAction({ loading: false, result: null });
  }

  function closeModal() {
    if (action.result?.ok) onActionDone();
    setModalUser(null);
  }

  async function handleAssign() {
    if (!modalUser || !selectedNumber) return;
    setAction({ loading: true, result: null });
    try {
      await invoke("assign_phone_number", {
        upn: modalUser.upn,
        phoneNumber: selectedNumber,
        numberType: selectedType,
      });
      setAction({ loading: false, result: { ok: true, msg: `${selectedNumber} assigné à ${modalUser.displayName}.` } });
    } catch (e) {
      setAction({ loading: false, result: { ok: false, msg: String(e) } });
    }
  }

  const columns: Column<OrphanLicense>[] = [
    { key: "displayName", label: t("tabs.orphanLicenses.name") },
    { key: "upn",         label: t("tabs.orphanLicenses.upn") },
    { key: "licenses",    label: t("tabs.orphanLicenses.licenses") },
    {
      key: "status", label: "Statut",
      render: (v) => <span className="badge badge-warning">{String(v)}</span>,
    },
    {
      key: "_action", label: "Action",
      render: (_, row) => (
        <button
          className="btn"
          style={{ fontSize: 12, padding: "3px 10px", color: "var(--accent)", borderColor: "var(--accent)" }}
          onClick={() => openModal(row)}
        >
          Assigner un numéro
        </button>
      ),
    },
  ];

  // Group free numbers by type
  const byType: Record<string, FreeNumber[]> = {};
  for (const fn_ of freeNumbers) {
    const t = fn_.numberType || "Autre";
    if (!byType[t]) byType[t] = [];
    byType[t].push(fn_);
  }

  return (
    <div>
      {/* Alert banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        background: "var(--warning-bg)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 8, padding: "12px 16px", marginBottom: 18,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9"  x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p style={{ color: "var(--warning)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Ces utilisateurs ont une licence Teams Phone mais <strong>aucun numéro Teams détecté</strong>.
          La détection repose maintenant sur l'inventaire Teams des affectations de numéros, avec repli limité si nécessaire.
        </p>
      </div>

      <DataTable<OrphanLicense>
        columns={columns}
        data={data}
        exportFilename="licences_orphelines.csv"
      />

      {/* Modal overlay */}
      {modalUser && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px 28px",
            width: 480, maxWidth: "calc(100vw - 40px)",
            maxHeight: "80vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
              Assigner un numéro
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-2)" }}>
              {modalUser.displayName} — <span style={{ color: "var(--text-3)", fontSize: 12 }}>{modalUser.upn}</span>
            </p>

            {freeNumbers.length === 0 ? (
              <p style={{ color: "var(--warning)", fontSize: 13 }}>
                Aucun numéro libre disponible. Vérifiez l'onglet "Numéros libres".
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {Object.entries(byType).map(([type, nums]) => (
                  <div key={type}>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.04em" }}>
                      {type.toUpperCase()}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {nums.map((fn_) => (
                        <label
                          key={fn_.number}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                            background: selectedNumber === fn_.number
                              ? "rgba(96,165,250,0.12)"
                              : "var(--bg-secondary)",
                            border: `1px solid ${selectedNumber === fn_.number ? "rgba(96,165,250,0.4)" : "var(--border)"}`,
                            transition: "background 0.15s, border-color 0.15s",
                          }}
                        >
                          <input
                            type="radio"
                            name="phoneNumber"
                            value={fn_.number}
                            checked={selectedNumber === fn_.number}
                            onChange={() => { setSelectedNumber(fn_.number); setSelectedType(fn_.numberType); }}
                            style={{ accentColor: "var(--accent)", flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", fontFamily: "monospace" }}>
                            {fn_.number}
                          </span>
                          {fn_.city && (
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{fn_.city}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {action.result && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 14,
                background: action.result.ok ? "var(--success-bg)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${action.result.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: action.result.ok ? "var(--success)" : "#f87171",
                fontSize: 13,
              }}>
                {action.result.msg}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" style={{ fontSize: 13, padding: "6px 16px" }} onClick={closeModal}>
                {action.result?.ok ? "Fermer & actualiser" : "Annuler"}
              </button>
              {!action.result?.ok && (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: "6px 16px" }}
                  disabled={!selectedNumber || action.loading || freeNumbers.length === 0}
                  onClick={handleAssign}
                >
                  {action.loading ? "En cours…" : "Confirmer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
