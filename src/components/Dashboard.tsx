import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { DashboardData, TabId } from "../types";
import PhoneUsersTab from "./tabs/PhoneUsersTab";
import FreeNumbersTab from "./tabs/FreeNumbersTab";
import OrphanLicensesTab from "./tabs/OrphanLicensesTab";
import UserLicensesTab from "./tabs/UserLicensesTab";
import SubscriptionsTab from "./tabs/SubscriptionsTab";
import CallQueuesTab from "./tabs/CallQueuesTab";
import AutoAttendantsTab from "./tabs/AutoAttendantsTab";
import ResourceAccountsTab from "./tabs/ResourceAccountsTab";
import DirectoryUsersTab from "./tabs/DirectoryUsersTab";

interface Props {
  data: DashboardData | null;
  lastRefresh: Date | null;
  loading: boolean;
  runtimeError: string | null;
  onRefresh: () => void;
  onDisconnect: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count: () => number;
  badge?: "warn" | "danger";
  section: string;
}

const SECTIONS = [
  { id: "telephonie", label: "TELEPHONIE" },
  { id: "licences", label: "LICENCES" },
  { id: "ressources", label: "RESSOURCES" },
];

type PsState = "idle" | "installing" | "done" | "error";

const PS_MODULE_MARKER = "Module PowerShell MicrosoftTeams indisponible";

export default function Dashboard({ data, lastRefresh, loading, runtimeError, onRefresh, onDisconnect }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("phoneUsers");
  const [psState, setPsState] = useState<PsState>("idle");
  const [psMsg, setPsMsg] = useState("");
  const [psInfo, setPsInfo] = useState<string>("");

  const psWarning = data?.warnings.find(w => w.includes(PS_MODULE_MARKER));
  const otherWarnings = data?.warnings.filter(w => !w.includes(PS_MODULE_MARKER)) ?? [];
  // Warnings de diagnostic PS (version PS, erreurs cmdlet) — séparés du marker principal
  const psDiagWarnings = data?.warnings.filter(w => w.startsWith("PowerShell Teams —") || w.startsWith("PowerShell ")) ?? [];

  const ps7Url = "https://aka.ms/powershell";
  const needsPs7 = psState === "error" && psMsg.includes("PowerShell 7");

  // Charger les infos PS dès que le banner est visible pour les onglets CQ/AA
  async function loadPsInfo() {
    if (psInfo) return;
    try {
      const info = await invoke<string>("get_ps_info");
      setPsInfo(info);
    } catch { /* non bloquant */ }
  }

  async function handleInstallModule() {
    setPsState("installing");
    setPsMsg("");
    try {
      const result = await invoke<string>("install_ps_module");
      setPsState("done");
      setPsMsg(
        result === "installed"
          ? "Module installé avec succès. Cliquez sur Actualiser pour recharger les données."
          : "Module déjà fonctionnel. Cliquez sur Actualiser pour recharger les données."
      );
    } catch (e) {
      setPsState("error");
      setPsMsg(String(e));
    }
  }

  const showPsBanner =
    (activeTab === "callQueues" || activeTab === "autoAttendants") &&
    (psWarning || psState === "installing" || psState === "done" || psState === "error");

  // Charger les infos PS quand le banner devient visible
  if (showPsBanner && !psInfo) { loadPsInfo(); }

  const nav: NavItem[] = [
    { id: "directoryUsers", label: "Tous les utilisateurs", section: "telephonie", icon: <PhoneIcon />, count: () => data?.directoryUsers.length ?? 0 },
    { id: "phoneUsers", label: "Utilisateurs", section: "telephonie", icon: <PhoneIcon />, count: () => data?.phoneUsers.length ?? 0 },
    { id: "freeNumbers", label: "Numéros libres", section: "telephonie", icon: <HashIcon />, count: () => data?.freeNumbers.length ?? 0, badge: (data?.freeNumbers.length ?? 0) > 0 ? "warn" : undefined },
    { id: "orphanLicenses", label: "Utilisateurs sans numéro", section: "telephonie", icon: <AlertIcon />, count: () => data?.orphanLicenses.length ?? 0, badge: (data?.orphanLicenses.length ?? 0) > 0 ? "danger" : undefined },
    { id: "userLicenses", label: "Licences utilisateurs", section: "licences", icon: <CreditCardIcon />, count: () => data?.userLicenses.length ?? 0 },
    { id: "subscriptions", label: "Abonnements", section: "licences", icon: <BarChartIcon />, count: () => data?.subscriptions.length ?? 0 },
    { id: "callQueues", label: "Files d'attente", section: "ressources", icon: <PhoneCallIcon />, count: () => data?.callQueues.length ?? 0 },
    { id: "autoAttendants", label: "Auto Attendants", section: "ressources", icon: <BotIcon />, count: () => data?.autoAttendants.length ?? 0 },
    { id: "resourceAccounts", label: "Comptes ressources", section: "ressources", icon: <WrenchIcon />, count: () => data?.resourceAccounts.length ?? 0 },
  ];

  function renderTab() {
    if (!data) {
      return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 36 }} />)}</div>;
    }
    switch (activeTab) {
      case "directoryUsers": return <DirectoryUsersTab data={data.directoryUsers} />;
      case "phoneUsers": return <PhoneUsersTab data={data.phoneUsers} />;
      case "freeNumbers": return <FreeNumbersTab data={data.freeNumbers} />;
      case "orphanLicenses": return <OrphanLicensesTab data={data.orphanLicenses} />;
      case "userLicenses": return <UserLicensesTab data={data.userLicenses} />;
      case "subscriptions": return <SubscriptionsTab data={data.subscriptions} />;
      case "callQueues": return <CallQueuesTab data={data.callQueues} />;
      case "autoAttendants": return <AutoAttendantsTab data={data.autoAttendants} />;
      case "resourceAccounts": return <ResourceAccountsTab data={data.resourceAccounts} />;
    }
  }

  const currentNav = nav.find((n) => n.id === activeTab);
  const tabLabel = currentNav?.label ?? "";

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
      <aside style={{ width: 250, flexShrink: 0, background: "var(--bg-card)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <PhoneIcon color="#fff" size={15} />
            </div>
            <div>
              <p style={{ color: "var(--text-1)", fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>Teams Manager</p>
              <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 2 }}>Microsoft 365</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          {SECTIONS.map((section) => {
            const items = nav.filter((n) => n.section === section.id);
            return (
              <div key={section.id} style={{ marginBottom: 16 }}>
                <p style={{ color: "var(--text-3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 6px", marginBottom: 4 }}>{section.label}</p>
                {items.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button key={item.id} className={`sidebar-item${active ? " active" : ""}`} onClick={() => setActiveTab(item.id)}>
                      {item.icon}
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      <span className={`sidebar-badge${item.badge ? ` ${item.badge}` : ""}`}>{item.count()}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "10px 8px 14px", borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={onDisconnect}>
            <LogoutIcon />
            Déconnexion
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: "var(--text-1)", fontSize: 15, fontWeight: 600, margin: 0 }}>{tabLabel}</h2>
            {(runtimeError || (data && (data.errors.length > 0 || otherWarnings.length > 0 || psWarning))) && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {runtimeError && <span className="badge badge-danger" title={runtimeError}>Erreur UI : {runtimeError.slice(0, 80)}{runtimeError.length > 80 ? "…" : ""}</span>}
                {data?.errors.map((e, i) => <span key={`e${i}`} className="badge badge-danger" title={e}>Erreur : {e.slice(0, 60)}{e.length > 60 ? "…" : ""}</span>)}
                {otherWarnings.map((w, i) => <span key={`w${i}`} className="badge badge-warning" title={w}>{w.slice(0, 80)}{w.length > 80 ? "…" : ""}</span>)}
                {psWarning && psState !== "done" && <span className="badge badge-warning" title={psWarning}>Module PS Teams : voir onglet CQ/AA</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {lastRefresh && <span style={{ color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>Actualisé le {lastRefresh.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} à {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
            <button className="btn btn-primary" onClick={onRefresh} disabled={loading}>{loading ? <SpinIcon /> : <RefreshIcon />}{loading ? "Chargement..." : "Actualiser"}</button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 20 }} className="fade-in">
          {showPsBanner && (
            <div style={{ marginBottom: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ color: "var(--accent-warn, #f59e0b)", flexShrink: 0, marginTop: 1 }}><AlertIcon /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                  Module PowerShell MicrosoftTeams requis
                </p>
                {psState === "idle" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>
                    Ce module est nécessaire pour récupérer les données de cet onglet via PowerShell.
                    {psWarning && <> L'erreur détectée est probablement une dépendance manquante ou cassée.</>}
                  </p>
                )}
                {/* Diagnostics PS : version et cmdlet errors */}
                {psDiagWarnings.map((w, i) => (
                  <p key={i} style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>{w}</p>
                ))}
                {psInfo && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-3)", fontFamily: "monospace" }}>{psInfo}</p>
                )}
                {psState === "installing" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>
                    Installation en cours… (cela peut prendre 1 à 3 minutes)
                  </p>
                )}
                {psState === "done" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-2)" }}>{psMsg}</p>
                )}
                {psState === "error" && !needsPs7 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-danger, #ef4444)" }}>{psMsg}</p>
                )}
                {psState === "error" && needsPs7 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-danger, #ef4444)" }}>
                    PowerShell 7 est requis pour le module MicrosoftTeams (DLL incompatible avec PS 5.1).
                    Installez-le gratuitement depuis Microsoft.
                  </p>
                )}
              </div>
              {/* Bouton "Voir les logs" toujours visible dans le banner */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button className="btn" style={{ fontSize: 12 }}
                  onClick={() => invoke("open_log_file").catch(() => {})}>
                  <LogIcon /> Voir les logs
                </button>
                {(psState === "idle" || (psState === "error" && !needsPs7)) && (
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleInstallModule}>
                    Installer le module
                  </button>
                )}
                {psState === "error" && needsPs7 && (
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => openUrl(ps7Url)}>
                    Télécharger PowerShell 7
                  </button>
                )}
                {psState === "installing" && (
                  <button className="btn btn-primary" style={{ fontSize: 12 }} disabled>
                    <SpinIcon /> Installation…
                  </button>
                )}
                {psState === "done" && (
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onRefresh}>
                    <RefreshIcon /> Actualiser
                  </button>
                )}
              </div>
            </div>
          )}
          {renderTab()}
        </main>
      </div>
    </div>
  );
}

function PhoneIcon({ color = "currentColor", size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.1 19.79 19.79 0 0 1 1.58 2.48a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.06 6.06l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function HashIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>; }
function AlertIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>; }
function CreditCardIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>; }
function BarChartIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>; }
function PhoneCallIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.1 19.79 19.79 0 0 1 1.58 2.48a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.06 6.06l1.77-1.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>; }
function BotIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg>; }
function WrenchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>; }
function LogoutIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>; }
function RefreshIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>; }
function LogIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>; }
function SpinIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>; }
