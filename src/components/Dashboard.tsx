import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { DashboardData, TabId } from "../types";
import { useI18n } from "../i18n";
import PhoneUsersTab from "./tabs/PhoneUsersTab";
import FreeNumbersTab from "./tabs/FreeNumbersTab";
import OrphanLicensesTab from "./tabs/OrphanLicensesTab";
import UserLicensesTab from "./tabs/UserLicensesTab";
import SubscriptionsTab from "./tabs/SubscriptionsTab";
import CallQueuesTab from "./tabs/CallQueuesTab";
import AutoAttendantsTab from "./tabs/AutoAttendantsTab";
import ResourceAccountsTab from "./tabs/ResourceAccountsTab";
import DirectoryUsersTab from "./tabs/DirectoryUsersTab";
import CartographieTab from "./tabs/CartographieTab";
import UpdateModal from "./UpdateModal";
import ChangelogModal from "./ChangelogModal";

interface Props {
  data: DashboardData | null;
  lastRefresh: Date | null;
  loading: boolean;
  runtimeError: string | null;
  onRefresh: () => void;
  onRefreshLicenses: () => void;
  onDisconnect: () => void;
  onSetup: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count: () => number;
  badge?: "warn" | "danger";
  section: string;
}


type PsState = "idle" | "installing" | "done" | "error";

const PS_MODULE_MARKER = "Module PowerShell MicrosoftTeams indisponible";

export default function Dashboard({ data, lastRefresh, loading, runtimeError, onRefresh, onRefreshLicenses, onDisconnect, onSetup }: Props) {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("phoneUsers");
  const [psState, setPsState] = useState<PsState>("idle");
  const [psMsg, setPsMsg] = useState("");
  const [psInfo, setPsInfo] = useState<string>("");
  const [platform, setPlatform] = useState<string>("windows");
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes?: string } | null>(null);
  const [appVersion, setAppVersion] = useState<string>("…");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "uptodate" | "error">("idle");
  const [showChangelog, setShowChangelog] = useState(false);

  const sections = [
    { id: "telephonie", label: t("nav.sections.telephony") },
    { id: "licences",   label: t("nav.sections.licenses") },
    { id: "ressources", label: t("nav.sections.resources") },
  ];

  useEffect(() => {
    invoke<string>("get_platform").then(setPlatform).catch(() => {});
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await invoke<{ version: string; notes?: string } | null>("check_update");
        if (result) setUpdateInfo(result);
      } catch { /* réseau indisponible — silencieux */ }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  async function handleManualCheck() {
    if (checkState === "checking") return;
    setCheckState("checking");
    try {
      const result = await invoke<{ version: string; notes?: string } | null>("check_update");
      if (result) {
        setUpdateInfo(result);
        setCheckState("idle");
      } else {
        setCheckState("uptodate");
        setTimeout(() => setCheckState("idle"), 3000);
      }
    } catch {
      setCheckState("error");
      setTimeout(() => setCheckState("idle"), 3000);
    }
  }


  const psWarning = data?.warnings.find(w => w.includes(PS_MODULE_MARKER));
  const otherWarnings = data?.warnings.filter(w => !w.includes(PS_MODULE_MARKER)) ?? [];
  // Warnings de diagnostic PS (version PS, erreurs cmdlet) — séparés du marker principal
  const psDiagWarnings = data?.warnings.filter(w => w.startsWith("PowerShell Teams —") || w.startsWith("PowerShell ")) ?? [];

  const ps7Url = "https://aka.ms/powershell";
  const needsPs7 = psState === "error" && psMsg.includes("PowerShell 7");
  const needsSecret = (psWarning ?? "").includes("Client Secret") || (psState === "error" && psMsg.includes("Client Secret"));

  async function openLogs() {
    try {
      await invoke("open_log_file");
    } catch (error) {
      await invoke("log_frontend_error", {
        context: "ouverture fichier de log",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  }

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
          ? t("ps.installed")
          : t("ps.alreadyInstalled")
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
    { id: "directoryUsers", label: t("nav.tabs.allUsers"), section: "telephonie", icon: <PhoneIcon />, count: () => data?.directoryUsers.length ?? 0 },
    { id: "phoneUsers", label: t("nav.tabs.phoneUsers"), section: "telephonie", icon: <PhoneIcon />, count: () => data?.phoneUsers.length ?? 0 },
    { id: "freeNumbers", label: t("nav.tabs.freeNumbers"), section: "telephonie", icon: <HashIcon />, count: () => data?.freeNumbers.length ?? 0, badge: (data?.freeNumbers.length ?? 0) > 0 ? "warn" : undefined },
    { id: "orphanLicenses", label: t("nav.tabs.orphanLicenses"), section: "telephonie", icon: <AlertIcon />, count: () => data?.orphanLicenses.length ?? 0, badge: (data?.orphanLicenses.length ?? 0) > 0 ? "danger" : undefined },
    { id: "userLicenses", label: t("nav.tabs.userLicenses"), section: "licences", icon: <CreditCardIcon />, count: () => data?.userLicenses.length ?? 0 },
    { id: "subscriptions", label: t("nav.tabs.subscriptions"), section: "licences", icon: <BarChartIcon />, count: () => data?.subscriptions.length ?? 0 },
    { id: "callQueues", label: t("nav.tabs.callQueues"), section: "ressources", icon: <PhoneCallIcon />, count: () => data?.callQueues.length ?? 0 },
    { id: "autoAttendants", label: t("nav.tabs.autoAttendants"), section: "ressources", icon: <BotIcon />, count: () => data?.autoAttendants.length ?? 0 },
    { id: "resourceAccounts", label: t("nav.tabs.resourceAccounts"), section: "ressources", icon: <WrenchIcon />, count: () => data?.resourceAccounts.length ?? 0 },
    { id: "cartographie", label: t("nav.tabs.cartography"), section: "ressources", icon: <MapIcon />, count: () => -1 },
  ];

  function renderTab() {
    if (!data) {
      return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 36 }} />)}</div>;
    }
    switch (activeTab) {
      case "directoryUsers": return <DirectoryUsersTab data={data.directoryUsers} />;
      case "phoneUsers": return <PhoneUsersTab data={data.phoneUsers} onActionDone={onRefresh} />;
      case "freeNumbers": return <FreeNumbersTab data={data.freeNumbers} />;
      case "orphanLicenses": return <OrphanLicensesTab data={data.orphanLicenses} freeNumbers={data.freeNumbers} onActionDone={onRefresh} />;
      case "userLicenses": return <UserLicensesTab data={data.userLicenses} />;
      case "subscriptions": return <SubscriptionsTab data={data.subscriptions} allUsers={data.directoryUsers} userLicenses={data.userLicenses} onActionDone={onRefreshLicenses} />;
      case "callQueues": return <CallQueuesTab data={data.callQueues} />;
      case "autoAttendants": return <AutoAttendantsTab data={data.autoAttendants} />;
      case "resourceAccounts": return <ResourceAccountsTab data={data.resourceAccounts} />;
      case "cartographie": return <CartographieTab data={data} />;
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
          {sections.map((section) => {
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
                      {item.count() >= 0 && <span className={`sidebar-badge${item.badge ? ` ${item.badge}` : ""}`}>{item.count()}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>


        <div style={{ padding: "10px 8px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={openLogs}>
            <LogIcon />
            {t("sidebar.viewLogs")}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={onSetup}>
            <SettingsIcon />
            {t("sidebar.settings")}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={onDisconnect}>
            <LogoutIcon />
            {t("sidebar.disconnect")}
          </button>
        </div>

        <div style={{ padding: "8px 8px 0", borderTop: "1px solid var(--border)" }}>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", color: checkState === "uptodate" ? "var(--accent)" : checkState === "error" ? "var(--text-danger, #ef4444)" : undefined }}
            onClick={handleManualCheck}
            disabled={checkState === "checking"}
          >
            {checkState === "checking" ? <SpinIcon /> : checkState === "uptodate" ? <CheckIcon /> : <UpdateCheckIcon />}
            {checkState === "checking" ? t("sidebar.checking") : checkState === "uptodate" ? t("sidebar.upToDate") : checkState === "error" ? t("sidebar.networkError") : t("sidebar.checkUpdates")}
          </button>
        </div>

        <div style={{ padding: "6px 8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 600 }}>
            Teams Manager v{appVersion}
          </span>
          <button
            onClick={() => setShowChangelog(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 11, padding: "1px 0", textDecoration: "underline", textUnderlineOffset: "2px", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            {t("sidebar.releaseNotes")}
          </button>
        </div>
      </aside>

      {showChangelog && (
        <ChangelogModal appVersion={appVersion} onClose={() => setShowChangelog(false)} />
      )}
      {updateInfo && (
        <UpdateModal
          version={updateInfo.version}
          notes={updateInfo.notes}
          onClose={() => setUpdateInfo(null)}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: "var(--text-1)", fontSize: 15, fontWeight: 600, margin: 0 }}>{tabLabel}</h2>
            {(runtimeError || (data && (data.errors.length > 0 || otherWarnings.length > 0 || psWarning))) && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {runtimeError && <span className="badge badge-danger" title={runtimeError}>{t("topbar.errorUi") + " :"} {runtimeError.slice(0, 80)}{runtimeError.length > 80 ? "…" : ""}</span>}
                {data?.errors.map((e, i) => <span key={`e${i}`} className="badge badge-danger" title={e}>{t("topbar.error") + " :"} {e.slice(0, 60)}{e.length > 60 ? "…" : ""}</span>)}
                {otherWarnings.map((w, i) => <span key={`w${i}`} className="badge badge-warning" title={w}>{w.slice(0, 80)}{w.length > 80 ? "…" : ""}</span>)}
                {psWarning && psState !== "done" && <span className="badge badge-warning" title={psWarning}>{t("topbar.psModuleWarning")}</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {lastRefresh && <span style={{ color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>{t("topbar.refreshedAt")} {lastRefresh.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" })} {t("topbar.at")} {lastRefresh.toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
            <button className="btn btn-primary" onClick={onRefresh} disabled={loading}>{loading ? <SpinIcon /> : <RefreshIcon />}{loading ? t("topbar.loading") : t("topbar.refresh")}</button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 20 }} className="fade-in">
          {showPsBanner && (
            <div style={{ marginBottom: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ color: "var(--accent-warn, #f59e0b)", flexShrink: 0, marginTop: 1 }}><AlertIcon /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
                  {t("ps.moduleRequired")}
                </p>
                {psState === "idle" && !needsSecret && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>
                    {t("ps.moduleDesc")}
                    {psWarning && <> L'erreur détectée est probablement une dépendance manquante ou cassée.</>}
                  </p>
                )}
                {needsSecret && (
                  <div style={{ margin: "6px 0 0", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                      {t("ps.clientSecretRequired")}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>
                      Le module PowerShell MicrosoftTeams v7.x ne supporte plus l'authentification déléguée non-interactive.
                      Ajoutez un Client Secret dans la configuration de l'application (roue dentée).
                    </p>
                    <ol style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-3)", paddingLeft: 16, lineHeight: 1.7 }}>
                      <li>portal.azure.com → App registrations → votre app → <strong>Certificates &amp; secrets</strong> → New client secret</li>
                      <li>Ajoutez la permission Application <code>Organization.Read.All</code> (Microsoft Graph)</li>
                      <li>Assignez le rôle <strong>Teams Administrator</strong> à l'application dans Microsoft Entra ID</li>
                      <li>Accordez le consentement administrateur, puis collez le secret dans <strong>Configuration</strong></li>
                    </ol>
                  </div>
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
                    {t("ps.installing")}
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
                    {t("ps.ps7Required")}
                  </p>
                )}
                {platform !== "windows" && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>
                    Sur <strong>{platform === "macos" ? "macOS" : "Linux"}</strong>, ces onglets nécessitent{" "}
                    <a href="https://github.com/PowerShell/PowerShell/releases" style={{ color: "var(--accent)" }}>PowerShell Core (pwsh)</a>{" "}
                    et le module MicrosoftTeams installés manuellement.
                  </p>
                )}
              </div>
              {(needsSecret || (platform === "windows" && !needsSecret && (psState === "idle" || psState === "error" || psState === "installing"))) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {needsSecret && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onSetup}>
                      <SettingsIcon /> {t("ps.configuration")}
                    </button>
                  )}
                  {platform === "windows" && !needsSecret && (psState === "idle" || (psState === "error" && !needsPs7)) && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleInstallModule}>
                      {t("ps.installModule")}
                    </button>
                  )}
                  {platform === "windows" && psState === "error" && needsPs7 && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => openUrl(ps7Url)}>
                      {t("ps.downloadPs7")}
                    </button>
                  )}
                  {psState === "installing" && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} disabled>
                      <SpinIcon /> {t("ps.installing")}
                    </button>
                  )}
                </div>
              )}
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
function SettingsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function MapIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>; }
function UpdateCheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>; }
function CheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>; }
