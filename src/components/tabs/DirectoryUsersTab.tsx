import { DirectoryUser } from "../../types";
import DataTable, { type Column } from "../DataTable";

interface Props {
  data?: DirectoryUser[];
}

const badgeOuiNon = (value: unknown) => {
  const text = String(value);
  return <span className={`badge ${text === "Oui" ? "badge-success" : "badge-danger"}`}>{text}</span>;
};

const userTypeBadge = (value: unknown) => {
  const text = String(value);
  if (text === "Externe") return <span className="badge badge-warning">Externe</span>;
  return <span className="badge badge-neutral">Interne</span>;
};

const columns: Column<DirectoryUser>[] = [
  { key: "displayName", label: "Nom" },
  { key: "upn", label: "UPN" },
  {
    key: "userType",
    label: "Type",
    tooltip: "Interne = membre de l'organisation (userType: Member). Externe = utilisateur invité (userType: Guest), généralement un collaborateur externe ajouté via Azure AD B2B.",
    render: userTypeBadge,
  },
  { key: "phoneNumber", label: "Numéro détecté" },
  {
    key: "hasPhoneLicense",
    label: "Licence phone",
    tooltip: "L'utilisateur possède une licence incluant Microsoft Teams Phone Standard (ou équivalente), nécessaire pour la téléphonie Teams (appels entrants et sortants via PSTN).",
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

export default function DirectoryUsersTab({ data }: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 18 }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Cette vue affiche <strong>tous les utilisateurs du tenant</strong>. La colonne "Numéro détecté" provient en priorité de l'inventaire d'affectation des numéros Teams, avec repli sur les données utilisateur Microsoft Graph lorsque l'inventaire n'est pas accessible.
        </p>
      </div>
      <DataTable columns={columns} data={data ?? []} exportFilename="tous_les_utilisateurs.csv" />
    </>
  );
}
