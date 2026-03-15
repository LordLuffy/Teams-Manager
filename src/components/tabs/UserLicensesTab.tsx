import { useState, useMemo, Fragment } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserLicense } from "../../types";

interface Props { data: UserLicense[]; }

interface UserGroup {
  displayName: string;
  upn: string;
  accountEnabled: string;
  licenses: UserLicense[];
}

export default function UserLicensesTab({ data }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Grouper par UPN
  const groups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>();
    for (const item of data) {
      if (!map.has(item.upn)) {
        map.set(item.upn, {
          displayName: item.displayName,
          upn: item.upn,
          accountEnabled: item.accountEnabled,
          licenses: [],
        });
      }
      map.get(item.upn)!.licenses.push(item);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "fr", { sensitivity: "base" })
    );
  }, [data]);

  // Filtrer par recherche
  const filtered = useMemo<UserGroup[]>(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.displayName.toLowerCase().includes(q) ||
        g.upn.toLowerCase().includes(q) ||
        g.licenses.some(
          (l) =>
            l.friendlyName.toLowerCase().includes(q) ||
            l.skuPartNumber.toLowerCase().includes(q)
        )
    );
  }, [groups, search]);

  const isSearchActive = search.trim().length > 0;

  function toggle(upn: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(upn)) next.delete(upn);
      else next.add(upn);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(filtered.map((g) => g.upn)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function isOpen(upn: string, group: UserGroup): boolean {
    if (expanded.has(upn)) return true;
    // Auto-déplier les groupes qui matchent la recherche sur une licence
    if (isSearchActive) {
      const q = search.toLowerCase();
      return group.licenses.some(
        (l) =>
          l.friendlyName.toLowerCase().includes(q) ||
          l.skuPartNumber.toLowerCase().includes(q)
      );
    }
    return false;
  }

  async function handleExport() {
    const headers = ["Nom", "UPN", "Licence", "SKU", "Compte actif"];
    const rows = data.map((l) => [
      l.displayName,
      l.upn,
      l.friendlyName,
      l.skuPartNumber,
      l.accountEnabled,
    ]);
    try {
      await invoke("export_csv", {
        headers,
        rows,
        filename: "licences_utilisateurs.csv",
      });
    } catch (error) {
      await invoke("log_frontend_error", {
        context: "export CSV licences utilisateurs",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  }

  const totalLicenses = data.length;

  return (
    <div>
      {/* Barre d'outils */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-3)" strokeWidth="2"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input"
            style={{ paddingLeft: 32, maxWidth: 320 }}
            placeholder="Rechercher un utilisateur ou une licence…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
          />
        </div>
        <span style={{ color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>
          {filtered.length} utilisateur{filtered.length !== 1 ? "s" : ""} · {totalLicenses} licence{totalLicenses !== 1 ? "s" : ""}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={expandAll}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          Tout déplier
        </button>
        <button className="btn btn-ghost btn-sm" onClick={collapseAll}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
          Tout replier
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleExport}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* Tableau en accordéon */}
      <div className="card" style={{ overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12 }}>
            {isSearchActive ? (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Aucun résultat pour «{search}»</p>
              </>
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>Aucune donnée</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 32, padding: "0 8px" }}></th>
                  <th>Nom</th>
                  <th>UPN</th>
                  <th style={{ textAlign: "center" }}>Nb licences</th>
                  <th>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Compte actif
                      <span
                        title="Indique si le compte Microsoft 365 de l'utilisateur est activé dans Azure Active Directory. Un compte inactif ne peut plus se connecter aux services Microsoft."
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: "rgba(96,165,250,0.18)", color: "var(--info)", fontSize: 9, fontWeight: 700, flexShrink: 0, cursor: "help" }}
                      >ⓘ</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => {
                  const open = isOpen(group.upn, group);
                  return (
                    <Fragment key={group.upn}>
                      {/* Ligne principale (groupe) */}
                      <tr
                        onClick={() => toggle(group.upn)}
                        style={{ cursor: "pointer" }}
                        className="accordion-row"
                      >
                        <td style={{ textAlign: "center", padding: "0 8px", color: "var(--text-3)" }}>
                          <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5"
                            style={{ transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "none" }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </td>
                        <td style={{ fontWeight: 500 }}>{group.displayName}</td>
                        <td style={{ color: "var(--text-2)", fontSize: 12 }}>{group.upn}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge">{group.licenses.length}</span>
                        </td>
                        <td>
                          <span className={`badge ${group.accountEnabled === "Oui" ? "badge-success" : "badge-danger"}`}>
                            {group.accountEnabled}
                          </span>
                        </td>
                      </tr>

                      {/* Lignes enfants (licences) */}
                      {open &&
                        group.licenses.map((lic, i) => (
                          <tr
                            key={`${group.upn}-${i}`}
                            style={{ background: "rgba(0,0,0,0.12)" }}
                          >
                            <td></td>
                            <td colSpan={2} style={{ paddingLeft: 32, color: "var(--text-2)", fontSize: 12 }}>
                              <span style={{ color: "var(--text-3)", marginRight: 8 }}>↳</span>
                              {lic.friendlyName}
                            </td>
                            <td colSpan={2} style={{ color: "var(--text-3)", fontSize: 11, fontFamily: "monospace" }}>
                              {lic.skuPartNumber}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
