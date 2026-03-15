import DataTable, { type Column } from "../DataTable";
import type { PhoneUser } from "../../types";

interface Props { data: PhoneUser[]; }

const badgeOuiNon = (value: unknown) => {
  const text = String(value);
  return <span className={`badge ${text === "Oui" ? "badge-success" : "badge-danger"}`}>{text}</span>;
};

const columns: Column<PhoneUser>[] = [
  { key: "displayName", label: "Nom" },
  { key: "upn", label: "UPN" },
  { key: "phoneNumber", label: "Numéro Teams" },
  {
    key: "evEnabled",
    label: "Voix entreprise",
    tooltip: "Enterprise Voice (EV) : indique si la fonctionnalité voix d'entreprise Teams est activée pour cet utilisateur, lui permettant de passer et recevoir des appels téléphoniques.",
    render: badgeOuiNon,
  },
  {
    key: "accountEnabled",
    label: "Compte actif",
    tooltip: "Indique si le compte Microsoft 365 de l'utilisateur est activé dans Azure Active Directory. Un compte inactif ne peut plus se connecter aux services Microsoft.",
    render: badgeOuiNon,
  },
  { key: "licenses", label: "Licences" },
];

export default function PhoneUsersTab({ data }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Utilisateurs ayant un <strong>numéro Teams actif</strong> et la fonctionnalité <strong>voix d'entreprise (EV)</strong> activée. Ces utilisateurs peuvent passer et recevoir des appels téléphoniques via Microsoft Teams.
        </p>
      </div>
      <DataTable<PhoneUser> columns={columns} data={data} exportFilename="utilisateurs_avec_numero.csv" />
    </>
  );
}
