import DataTable, { type Column } from "../DataTable";
import type { ResourceAccount } from "../../types";
import { useI18n } from "../../i18n";

interface Props { data: ResourceAccount[]; }

export default function ResourceAccountsTab({ data }: Props) {
  const { t } = useI18n();

  const columns: Column<ResourceAccount>[] = [
    { key: "displayName", label: t("tabs.resourceAccounts.name") },
    { key: "upn",         label: t("tabs.resourceAccounts.upn") },
    { key: "phoneNumber", label: t("tabs.resourceAccounts.phone") },
    {
      key: "licensed",
      label: t("tabs.resourceAccounts.licensed"),
      tooltip: t("tabs.resourceAccounts.licensedTooltip"),
      render: (v) => {
        const isYes = v === "Oui" || v === "true";
        return <span className={`badge ${isYes ? "badge-success" : "badge-neutral"}`}>{isYes ? t("common.yes") : t("common.no")}</span>;
      },
    },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: t("tabs.resourceAccounts.infoDesc") }} />
      </div>
      <DataTable<ResourceAccount> columns={columns} data={data} exportFilename="resource_accounts.csv" />
    </>
  );
}
