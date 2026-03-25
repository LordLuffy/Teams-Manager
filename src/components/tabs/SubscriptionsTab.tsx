import { useState } from "react";
import DataTable, { type Column } from "../DataTable";
import type { Subscription, DirectoryUser, UserLicense } from "../../types";
import { useI18n } from "../../i18n";
import LicenseManagerModal from "../LicenseManagerModal";

interface Props {
  data: Subscription[];
  allUsers: DirectoryUser[];
  userLicenses: UserLicense[];
  onActionDone: () => void;
}

function availableCell(v: unknown, row: Subscription) {
  const n = Number(v);
  const color = row.status === "OK" ? "var(--success)" : row.status === "SURPLUS" ? "var(--warning)" : "var(--danger)";
  return <span style={{ color, fontWeight: row.status === "OK" ? 500 : 700 }}>{n}</span>;
}

export default function SubscriptionsTab({ data, allUsers, userLicenses, onActionDone }: Props) {
  const { t } = useI18n();
  const totalConsumed = data.reduce((sum, s) => sum + s.consumed, 0);
  const [manageSub, setManageSub] = useState<Subscription | null>(null);

  function statusBadge(status: string) {
    if (status === "OK") return <span className="badge badge-success">{t("tabs.subscriptions.statusOk")}</span>;
    if (status === "SURPLUS") return <span className="badge badge-warning">{t("tabs.subscriptions.statusSurplus")}</span>;
    if (status === "SURPLUS IMPORTANT") return <span className="badge badge-danger">{t("tabs.subscriptions.statusSurplusHigh")}</span>;
    if (status === "DEPASSEMENT") return <span className="badge badge-danger">{t("tabs.subscriptions.statusOverflow")}</span>;
    return <span className="badge badge-neutral">{status}</span>;
  }

  const columns: Column<Subscription>[] = [
    { key: "friendlyName", label: t("tabs.subscriptions.product") },
    { key: "sku", label: "SKU" },
    { key: "purchased", label: t("tabs.subscriptions.total") },
    { key: "suspended", label: t("tabs.subscriptions.suspended") },
    { key: "consumed", label: t("tabs.subscriptions.assigned") },
    { key: "available", label: t("tabs.subscriptions.available"), render: availableCell },
    { key: "status", label: t("common.status"), render: (v) => statusBadge(String(v)) },
    {
      key: "_actions",
      label: "",
      render: (_v, row) =>
        row.isFree ? null : (
          <button
            className="btn"
            style={{ padding: "2px 10px", fontSize: 11, fontWeight: 600 }}
            onClick={() => setManageSub(row)}
          >
            {t("tabs.subscriptions.manage")}
          </button>
        ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          </div>
          <div>
            <p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>{data.length}</p>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>{data.length !== 1 ? t("tabs.subscriptions.subscriptionPlural") : t("tabs.subscriptions.subscriptionSingular")}</p>
          </div>
        </div>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
          </div>
          <div>
            <p style={{ color: "var(--text-1)", fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1 }}>{totalConsumed.toLocaleString()}</p>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>{t("tabs.subscriptions.consumedLabel")}</p>
          </div>
        </div>
      </div>
      <div
        style={{ background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.2)", color: "var(--info)", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: t("tabs.subscriptions.statusInfo") }}
      />
      <DataTable<Subscription> columns={columns} data={data} exportFilename="subscriptions.csv" />

      {manageSub && (
        <LicenseManagerModal
          sub={manageSub}
          allUsers={allUsers}
          userLicenses={userLicenses}
          onClose={() => setManageSub(null)}
          onSaved={onActionDone}
        />
      )}
    </div>
  );
}
