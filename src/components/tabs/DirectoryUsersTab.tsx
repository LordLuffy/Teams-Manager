import { DirectoryUser } from "../../types";
import DataTable, { type Column } from "../DataTable";
import { useI18n } from "../../i18n";

interface Props {
  data?: DirectoryUser[];
}

export default function DirectoryUsersTab({ data }: Props) {
  const { t } = useI18n();

  const badgeYesNo = (value: unknown) => {
    const raw = String(value);
    const isYes = raw === "Oui" || raw === "true" || raw === "True";
    return <span className={`badge ${isYes ? "badge-success" : "badge-danger"}`}>{isYes ? t("common.yes") : t("common.no")}</span>;
  };

  const userTypeBadge = (value: unknown) => {
    const raw = String(value);
    if (raw === "Externe") return <span className="badge badge-warning">{t("common.external")}</span>;
    return <span className="badge badge-neutral">{t("common.internal")}</span>;
  };

  const columns: Column<DirectoryUser>[] = [
    { key: "displayName", label: t("tabs.allUsers.name") },
    { key: "upn", label: t("tabs.allUsers.upn") },
    {
      key: "userType",
      label: t("common.type"),
      tooltip: t("tabs.allUsers.typeTooltip"),
      render: userTypeBadge,
    },
    { key: "phoneNumber", label: t("tabs.allUsers.phone") },
    {
      key: "hasPhoneLicense",
      label: t("tabs.allUsers.licensed"),
      tooltip: t("tabs.allUsers.licensedTooltip"),
      render: badgeYesNo,
    },
    {
      key: "accountEnabled",
      label: t("common.accountActive"),
      tooltip: t("tabs.allUsers.accountTooltip"),
      render: badgeYesNo,
    },
    { key: "licenses", label: t("common.licenses") },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p
          style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: t("tabs.allUsers.infoDesc") }}
        />
      </div>
      <DataTable columns={columns} data={data ?? []} exportFilename="all_users.csv" />
    </>
  );
}
