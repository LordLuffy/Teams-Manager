import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import DataTable, { type Column } from "../DataTable";
import type { PhoneUser } from "../../types";
import { useI18n } from "../../i18n";

interface Props {
  data: PhoneUser[];
  onActionDone: () => void;
}

interface ConfirmState {
  user: PhoneUser;
  loading: boolean;
  result: { ok: boolean; msg: string } | null;
}

export default function PhoneUsersTab({ data, onActionDone }: Props) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const badgeYesNo = (value: unknown) => {
    const raw = String(value);
    const isYes = raw === "Oui" || raw === "true" || raw === "True";
    return <span className={`badge ${isYes ? "badge-success" : "badge-danger"}`}>{isYes ? t("common.yes") : t("common.no")}</span>;
  };

  function openConfirm(row: PhoneUser) {
    setConfirm({ user: row, loading: false, result: null });
  }

  function closeConfirm() {
    if (confirm?.result?.ok) onActionDone();
    setConfirm(null);
  }

  async function handleUnassign() {
    if (!confirm) return;
    setConfirm((c) => c ? { ...c, loading: true, result: null } : null);
    try {
      await invoke("unassign_phone_number", { upn: confirm.user.upn });
      setConfirm((c) => c ? { ...c, loading: false, result: { ok: true, msg: `${t("tabs.phoneUsers.unassignBtn")} — ${c.user.displayName}` } } : null);
    } catch (e) {
      setConfirm((c) => c ? { ...c, loading: false, result: { ok: false, msg: String(e) } } : null);
    }
  }

  const columns: Column<PhoneUser>[] = [
    { key: "displayName", label: t("tabs.phoneUsers.name") },
    { key: "upn", label: t("tabs.phoneUsers.upn") },
    { key: "phoneNumber", label: t("tabs.phoneUsers.phone") },
    {
      key: "evEnabled",
      label: t("tabs.phoneUsers.enterpriseVoice"),
      tooltip: t("tabs.phoneUsers.evTooltip"),
      render: badgeYesNo,
    },
    {
      key: "accountEnabled",
      label: t("common.accountActive"),
      tooltip: t("tabs.phoneUsers.accountTooltip"),
      render: badgeYesNo,
    },
    { key: "licenses", label: t("common.licenses") },
    {
      key: "_action", label: t("common.action"),
      render: (_, row) => (
        <button
          className="btn"
          style={{ fontSize: 12, padding: "3px 10px", color: "var(--danger, #f87171)", borderColor: "rgba(239,68,68,0.4)" }}
          onClick={() => openConfirm(row)}
        >
          {t("tabs.phoneUsers.unassignBtn")}
        </button>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p
          style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: t("tabs.phoneUsers.infoDesc") }}
        />
      </div>
      <DataTable<PhoneUser> columns={columns} data={data} exportFilename="phone_users.csv" />

      {confirm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeConfirm(); }}
        >
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 28px", width: 420, maxWidth: "calc(100vw - 40px)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
              {t("tabs.phoneUsers.modalTitle")}
            </h3>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-2)" }}>{confirm.user.displayName}</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-3)", fontFamily: "monospace" }}>{confirm.user.phoneNumber}</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              {t("tabs.phoneUsers.modalDesc")}
            </p>

            {confirm.result && (
              <div style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 14, background: confirm.result.ok ? "var(--success-bg)" : "rgba(239,68,68,0.1)", border: `1px solid ${confirm.result.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, color: confirm.result.ok ? "var(--success)" : "#f87171", fontSize: 13 }}>
                {confirm.result.msg}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" style={{ fontSize: 13, padding: "6px 16px" }} onClick={closeConfirm}>
                {confirm.result?.ok ? t("common.closeRefresh") : t("common.cancel")}
              </button>
              {!confirm.result?.ok && (
                <button
                  className="btn"
                  style={{ fontSize: 13, padding: "6px 16px", color: "var(--danger, #f87171)", borderColor: "rgba(239,68,68,0.4)" }}
                  disabled={confirm.loading}
                  onClick={handleUnassign}
                >
                  {confirm.loading ? t("common.inProgress") : t("tabs.phoneUsers.confirmUnassign")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
