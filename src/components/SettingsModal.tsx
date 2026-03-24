import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n, type Lang } from "../i18n";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "connexion" | "apparence" | "systeme";

interface Props {
  onConnect: () => void;
  onClose: () => void;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const THEMES = [
  { id: "sombre",      label: "Sombre",      bg: "#0d1117", accent: "#3b82f6" },
  { id: "clair",       label: "Clair",       bg: "#ffffff", accent: "#3b82f6", dark: false },
  { id: "nord",        label: "Nord",        bg: "#3b4252", accent: "#88c0d0" },
  { id: "dracula",     label: "Dracula",     bg: "#282a36", accent: "#bd93f9" },
  { id: "tokyo-night", label: "Tokyo Night", bg: "#16161e", accent: "#7aa2f7" },
  { id: "ocean",       label: "Océan",       bg: "#0f2240", accent: "#0ea5e9" },
  { id: "foret",       label: "Forêt",       bg: "#111f11", accent: "#22c55e" },
  { id: "gruvbox",     label: "Gruvbox",     bg: "#282828", accent: "#fabd2f" },
  { id: "monokai",     label: "Monokai",     bg: "#272822", accent: "#a6e22e" },
  { id: "rose-pine",   label: "Rose Pine",   bg: "#1f1d2e", accent: "#c4a7e7" },
];

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
];

function applyTheme(themeId: string) {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem("tm-theme", themeId);
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function SettingsModal({ onConnect, onClose }: Props) {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>("connexion");

  // Connexion
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showConnection, setShowConnection] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [connectErr, setConnectErr] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Apparence
  const [theme, setTheme] = useState(() => localStorage.getItem("tm-theme") ?? "sombre");

  // Système
  const [debugMode, setDebugMode] = useState(() => localStorage.getItem("tm-debug") === "true");
  const [logPath, setLogPath] = useState("");
  const [defaultLogPath, setDefaultLogPath] = useState("");

  // Feedback
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<{ tenant_id: string; client_id: string; client_secret?: string; log_path?: string } | null>("load_config");
        if (cfg) {
          setTenantId(cfg.tenant_id ?? "");
          setClientId(cfg.client_id ?? "");
          setClientSecret(cfg.client_secret ?? "");
          setLogPath(cfg.log_path ?? "");
        }
      } catch { /* silencieux */ }
      try {
        const p = await invoke<string | null>("get_log_path");
        if (p) setDefaultLogPath(p);
      } catch { /* silencieux */ }
    })();
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleReconnect() {
    if (!tenantId.trim() || !clientId.trim()) {
      setConnectErr("Le Tenant ID et le Client ID sont obligatoires.");
      return;
    }
    setConnecting(true); setConnectErr("");
    try {
      await invoke("save_config", { config: { tenant_id: tenantId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim() } });
      onConnect();
    } catch (e) { setConnectErr(e instanceof Error ? e.message : String(e)); }
    finally { setConnecting(false); }
  }

  async function pickLogFolder() {
    try {
      const p = await invoke<string | null>("pick_log_folder");
      if (p) setLogPath(p);
    } catch { /* silencieux */ }
  }

  async function handleSave() {
    setSaving(true); setSaveErr(""); setSaveMsg("");
    try {
      const config: { tenant_id: string; client_id: string; client_secret: string; log_path?: string } = {
        tenant_id: tenantId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim(),
      };
      if (logPath.trim()) config.log_path = logPath.trim();
      await invoke("save_config", { config });
      localStorage.setItem("tm-debug", String(debugMode));
      await invoke("set_debug_mode", { enabled: debugMode });
      setSaveMsg(t("settings.saved"));
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) { setSaveErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function handleReset() {
    applyTheme("sombre");
    setTheme("sombre");
    setLang("en" as Lang);
    setDebugMode(false);
    setLogPath("");
    localStorage.removeItem("tm-debug");
    await invoke("set_debug_mode", { enabled: false });
    await invoke("save_config", { config: { tenant_id: tenantId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim() } });
    setSaveMsg(t("settings.reset.done"));
    setTimeout(() => setSaveMsg(""), 3000);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 680, height: 580, display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{t("settings.title")}</h2>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>Teams Manager</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18, padding: "4px", lineHeight: 1, borderRadius: 6 }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 2 }}>
            {(["connexion", "apparence", "systeme"] as Tab[]).map(tabId => (
              <button key={tabId} onClick={() => setTab(tabId)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 500, borderBottom: tab === tabId ? "2px solid var(--accent)" : "2px solid transparent", color: tab === tabId ? "var(--accent)" : "var(--text-3)", marginBottom: -1, borderRadius: 0, transition: "color 0.15s" }}>
                {tabId === "connexion" ? t("settings.tabs.connection") : tabId === "apparence" ? t("settings.tabs.appearance") : t("settings.tabs.system")}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* ─ Connexion ─ */}
          {tab === "connexion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Azure AD */}
              <Section label={t("settings.connection.accordion")} open={showConnection} onToggle={() => setShowConnection(v => !v)}>
                <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                  <p style={{ color: "var(--info)", fontSize: 12, fontWeight: 600, margin: "0 0 5px" }}>{t("settings.connection.azureInfoTitle")}</p>
                  <ol style={{ color: "var(--text-3)", fontSize: 12, paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
                    <li>{t("settings.connection.azureStep1")}</li>
                    <li>{t("settings.connection.azureStep2")}</li>
                    <li>{t("settings.connection.azureStep3")}</li>
                    <li>{t("settings.connection.azureStep4")}</li>
                  </ol>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 5 }}>{t("settings.connection.tenantId")}</label>
                    <input className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={e => setTenantId(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 5 }}>{t("settings.connection.clientId")}</label>
                    <input className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={clientId} onChange={e => setClientId(e.target.value)} />
                  </div>
                </div>
                {connectErr && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8, marginBottom: 0 }}>{connectErr}</p>}
                <button className="btn btn-primary" style={{ width: "100%", marginTop: 14, justifyContent: "center" }} onClick={handleReconnect} disabled={connecting}>
                  {connecting ? t("settings.connection.connecting") : t("settings.connection.reconnect")}
                </button>
              </Section>

              {/* Client Secret */}
              <Section label={t("settings.connection.psAccordion")} open={showSecret} onToggle={() => setShowSecret(v => !v)}>
                <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                  <p style={{ color: "var(--warning)", fontSize: 12, fontWeight: 600, margin: "0 0 5px" }}>{t("settings.connection.secretInfoTitle")}</p>
                  <ol style={{ color: "var(--text-3)", fontSize: 12, paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
                    <li>{t("settings.connection.secretStep1")}</li>
                    <li>{t("settings.connection.secretStep2")}</li>
                    <li>{t("settings.connection.secretStep3")}</li>
                    <li>{t("settings.connection.secretStep4")}</li>
                  </ol>
                </div>
                <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 5 }}>
                  {t("settings.connection.secretLabel")} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>{t("settings.connection.secretOptional")}</span>
                </label>
                <input className="input" type="password" placeholder="Collez la valeur du secret ici" value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
                <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 6, marginBottom: 0 }}>{t("settings.connection.secretNote")}</p>
              </Section>
            </div>
          )}

          {/* ─ Apparence ─ */}
          {tab === "apparence" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px" }}>{t("settings.appearance.desc")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {THEMES.map(th => {
                  const active = theme === th.id;
                  return (
                    <button key={th.id} onClick={() => { setTheme(th.id); applyTheme(th.id); }}
                      style={{ background: active ? "var(--accent-dim)" : "var(--bg-hover)", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: "10px 8px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "border-color 0.15s" }}>
                      {/* Mini preview */}
                      <div style={{ width: 72, height: 44, borderRadius: 6, background: th.bg, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, padding: "8px 10px" }}>
                        <div style={{ height: 5, borderRadius: 3, background: th.accent, width: "70%" }} />
                        <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.25)", width: "90%" }} />
                        <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.15)", width: "55%" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? "var(--accent)" : "var(--text-2)" }}>{th.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─ Système ─ */}
          {tab === "systeme" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Langue */}
              <SettingRow icon="🌐" label={t("settings.system.language")} desc={t("settings.system.languageDesc")}>
                <div style={{ display: "flex", gap: 6 }}>
                  {LANGUAGES.map(l => (
                    <button key={l.id} onClick={() => setLang(l.id as Lang)}
                      className={lang === l.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </SettingRow>

              {/* Mode débogage */}
              <SettingRow icon="🐛" label={t("settings.system.debug")} desc={t("settings.system.debugDesc")}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setDebugMode(true)} className={debugMode ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>{t("settings.system.debugOn")}</button>
                  <button onClick={() => setDebugMode(false)} className={!debugMode ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>{t("settings.system.debugOff")}</button>
                </div>
                {debugMode && (
                  <div style={{ marginTop: 12, background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{t("settings.system.logFile")}</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input" style={{ flex: 1, fontSize: 12 }} placeholder={defaultLogPath || "Chemin AppData par défaut"} value={logPath} onChange={e => setLogPath(e.target.value)} />
                      <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={pickLogFolder}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                        {t("settings.system.logBrowse")}
                      </button>
                    </div>
                    {logPath ? (
                      <button onClick={() => setLogPath("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 11, padding: 0, marginTop: 5 }}>{t("settings.system.logReset")}</button>
                    ) : defaultLogPath ? (
                      <p style={{ color: "var(--text-3)", fontSize: 11, margin: "5px 0 0" }}>{defaultLogPath}</p>
                    ) : null}
                  </div>
                )}
              </SettingRow>

              {/* Réinitialiser */}
              <SettingRow icon="🔄" label={t("settings.system.resetTitle")} desc={t("settings.system.resetDesc")}>
                <button className="btn btn-sm" style={{ color: "var(--danger)", borderColor: "var(--danger-bg)", background: "var(--danger-bg)" }} onClick={handleReset}>
                  {t("settings.system.resetBtn")}
                </button>
              </SettingRow>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {saveMsg && <span style={{ flex: 1, fontSize: 12, color: "var(--success)" }}>✓ {saveMsg}</span>}
          {saveErr && <span style={{ flex: 1, fontSize: 12, color: "var(--danger)" }}>{saveErr}</span>}
          {!saveMsg && !saveErr && <span style={{ flex: 1 }} />}
          <button className="btn btn-ghost" style={{ padding: "8px 20px" }} onClick={onClose}>{t("settings.close")}</button>
          <button className="btn btn-primary" style={{ padding: "8px 20px" }} onClick={handleSave} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Section({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-2)", fontSize: 13, fontWeight: 500, width: "100%", textAlign: "left", marginBottom: open ? 12 : 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function SettingRow({ icon, label, desc, children }: { icon: string; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 16, lineHeight: 1.3 }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{label}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-3)" }}>{desc}</p>
        </div>
      </div>
      <div style={{ paddingLeft: 26 }}>{children}</div>
    </div>
  );
}
