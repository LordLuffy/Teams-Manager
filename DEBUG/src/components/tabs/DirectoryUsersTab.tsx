import React from "react";
import { DirectoryUser } from "../../types";
import DataTable from "../DataTable";

interface Props {
  data: DirectoryUser[];
}

export default function DirectoryUsersTab({ data }: Props) {

  const columns = [
    { key: "displayName", label: "Nom" },
    { key: "upn", label: "UPN" },
    { key: "phoneNumber", label: "Numéro détecté" },
    { key: "hasPhoneLicense", label: "Licence phone" },
    { key: "accountEnabled", label: "Compte actif" },
    { key: "usageLocation", label: "Pays" },
    { key: "licenses", label: "Licences" },
  ];

  return (
    <>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "var(--info-bg)",
        border: "1px solid rgba(96,165,250,0.25)",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 18,
      }}>
        <p style={{
          color: "var(--info)",
          fontSize: 13,
          margin: 0,
          lineHeight: 1.5
        }}>
          Cette vue affiche <strong>tous les utilisateurs du tenant</strong>.  
          La colonne "Numéro détecté" correspond au champ <code>businessPhones</code> de Microsoft Graph.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        exportFilename="tous_les_utilisateurs.csv"
      />
    </>
  );
}