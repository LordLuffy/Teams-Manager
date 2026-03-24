import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  /** Called after saving Tenant/Client ID → redirects to auth flow */
  onConnect: () => void;
  /** Called when closing from settings mode without saving (back to dashboard) */
  onClose?: () => void;
  /** True when opened from the Dashboard settings button (vs first-time setup) */
  isSettings?: boolean;
}

function AccordionHeader({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        color: "var(--text-2)",
        fontSize: 13,
        fontWeight: 500,
        width: "100%",
        textAlign: "left",
      }}
      onClick={onToggle}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      {label}
    </button>
  );
}

export default function SetupScreen({ onConnect, onClose, isSettings = false }: Props) {
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [logPath, setLogPath] = useState("");
  const [defaultLogPath, setDefaultLogPath] = useState("");

  // Accordion state — connection open by default
  const [showConnection, setShowConnection] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const [connectErr, setConnectErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<{
          tenant_id: string;
          client_id: string;
          client_secret?: string;
          log_path?: string;
        } | null>("load_config");
        if (cfg) {
          setTenantId(cfg.tenant_id ?? "");
          setClientId(cfg.client_id ?? "");
          setClientSecret(cfg.client_secret ?? "");
          setLogPath(cfg.log_path ?? "");
        }
      } catch (error) {
        await invoke("log_frontend_error", {
          context: "chargement config écran paramètres",
          message: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
      }

      try {
        const current = await invoke<string | null>("get_log_path");
        if (current) setDefaultLogPath(current);
      } catch { /* silencieux */ }
    })();
  }, []);

  async function pickLogFolder() {
    try {
      const picked = await invoke<string | null>("pick_log_folder");
      if (picked) setLogPath(picked);
    } catch (error) {
      await invoke("log_frontend_error", {
        context: "sélection dossier logs",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
  }

  /** Saves Tenant/Client ID then triggers auth flow */
  async function handleConnect() {
    if (!tenantId.trim() || !clientId.trim()) {
      setConnectErr("Le Tenant ID et le Client ID sont obligatoires.");
      return;
    }
    setConnecting(true);
    setConnectErr("");
    try {
      const config: {
        tenant_id: string;
        client_id: string;
        client_secret: string;
        log_path?: string;
      } = {
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        // Always send the field: empty string = delete, non-empty = save
        client_secret: clientSecret.trim(),
      };
      if (logPath.trim()) config.log_path = logPath.trim();
      await invoke("save_config", { config });
      onConnect();
    } catch (error) {
      setConnectErr(error instanceof Error ? error.message : String(error));
      await invoke("log_frontend_error", {
        context: "enregistrement config connexion",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    } finally {
      setConnecting(false);
    }
  }

  /** Saves only Client Secret + log path — does NOT trigger re-auth */
  async function handleSaveSettings() {
    setSaving(true);
    setSaveErr("");
    setSaveMsg("");
    try {
      const config: {
        tenant_id: string;
        client_id: string;
        client_secret: string;
        log_path?: string;
      } = {
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        // Always send the field: empty string = delete existing secret, non-empty = save
        client_secret: clientSecret.trim(),
      };
      if (logPath.trim()) config.log_path = logPath.trim();
      await invoke("save_config", { config });
      setSaveMsg("Paramètres enregistrés.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (error) {
      setSaveErr(error instanceof Error ? error.message : String(error));
      await invoke("log_frontend_error", {
        context: "enregistrement paramètres avancés",
        message: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen fade-in"
      style={{ background: "var(--bg-primary)", overflowY: "auto", padding: "20px 0" }}
    >
      <div className="card p-8 fade-in" style={{ width: "100%", maxWidth: 500 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: "var(--accent-dim)", border: "1px solid rgba(59,130,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 style={{ color: "var(--text-1)", fontSize: 18, fontWeight: 600, margin: 0 }}>
                {isSettings ? "Paramètres" : "Configuration"}
              </h1>
              <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>Teams Manager</p>
            </div>
          </div>

          {isSettings && onClose && (
            <button
              className="btn btn-ghost"
              style={{ padding: "6px 14px", fontSize: 12, gap: 6 }}
              onClick={onClose}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Fermer
            </button>
          )}
        </div>

        {/* ── Section 1 : Connexion Azure AD ── */}
        <div>
          <AccordionHeader
            open={showConnection}
            onToggle={() => setShowConnection(!showConnection)}
            label="Connexion Azure AD"
          />

          {showConnection && (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                <p style={{ color: "var(--info)", fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 0 }}>Enregistrement Azure AD requis</p>
                <ol style={{ color: "var(--text-3)", fontSize: 12, paddingLeft: 16, lineHeight: 1.85, margin: 0 }}>
                  <li>Allez sur <strong style={{ color: "var(--text-2)" }}>portal.azure.com</strong> → App registrations → New registration</li>
                  <li>Choisissez <em>Public client / native</em> comme type de plateforme</li>
                  <li>Permissions API (déléguées) : <code style={{ color: "var(--info)" }}>User.Read.All</code>, <code style={{ color: "var(--info)" }}>Directory.Read.All</code>, <code style={{ color: "var(--info)" }}>Organization.Read.All</code></li>
                  <li>Dans Authentication, activez <em>Allow public client flows</em></li>
                  <li>Copiez le Tenant ID et le Client (Application) ID ci-dessous</li>
                </ol>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Tenant ID</label>
                  <input className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Client (Application) ID</label>
                  <input className="input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
              </div>

              {connectErr && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10, marginBottom: 0 }}>{connectErr}</p>
              )}

              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 16, justifyContent: "center", padding: "9px 0" }}
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? "Connexion en cours…" : isSettings ? "Reconnecter avec Microsoft" : "Se connecter avec Microsoft"}
              </button>
            </div>
          )}
        </div>

        {/* ── Section 2 : Client Secret CQ / AA ── */}
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <AccordionHeader
            open={showSecret}
            onToggle={() => setShowSecret(!showSecret)}
            label="Files d'attente & Standards automatiques (optionnel)"
          />

          {showSecret && (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ color: "var(--warn, #f59e0b)", fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 0 }}>Client Secret requis pour ces onglets</p>
                <p style={{ color: "var(--text-3)", fontSize: 12, margin: "0 0 8px" }}>
                  Le module PowerShell MicrosoftTeams (v7.x) nécessite une authentification application pour fonctionner de façon non-interactive.
                </p>
                <ol style={{ color: "var(--text-3)", fontSize: 12, paddingLeft: 16, lineHeight: 1.85, margin: "0 0 8px" }}>
                  <li>Dans votre App Registration → <strong style={{ color: "var(--text-2)" }}>Certificates &amp; secrets</strong> → New client secret</li>
                  <li>Copiez la <em>Value</em> (visible une seule fois) et collez-la ci-dessous</li>
                  <li>Dans <strong style={{ color: "var(--text-2)" }}>API permissions</strong> → Add : <code style={{ color: "var(--info)" }}>Organization.Read.All</code> (Application, Graph)</li>
                  <li>Dans <strong style={{ color: "var(--text-2)" }}>Roles and administrators</strong> (Microsoft Entra ID) → assignez le rôle <em>Teams Administrator</em> à votre application</li>
                  <li>Accordez le consentement administrateur</li>
                </ol>
                <p style={{ color: "var(--text-3)", fontSize: 11, margin: 0 }}>
                  Référence : <a href="https://learn.microsoft.com/microsoftteams/teams-powershell-application-authentication" target="_blank" rel="noreferrer" style={{ color: "var(--info)" }}>teams-powershell-application-authentication</a>
                </p>
              </div>

              <div>
                <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Client Secret <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optionnel)</span>
                </label>
                <input
                  className="input"
                  type="password"
                  placeholder="Collez la valeur du secret ici"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 6, marginBottom: 0 }}>
                  Stocké dans le Gestionnaire d'informations d'identification Windows — jamais en clair dans les fichiers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 3 : Dossier des journaux ── */}
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <AccordionHeader
            open={showLog}
            onToggle={() => setShowLog(!showLog)}
            label="Dossier des journaux (optionnel)"
          />

          {showLog && (
            <div style={{ marginTop: 12 }}>
              <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 0, marginBottom: 10 }}>
                Par défaut, les logs sont enregistrés dans le dossier AppData de l'application. Vous pouvez choisir un emplacement personnalisé.
              </p>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 12 }}
                  placeholder={defaultLogPath || "Chemin AppData par défaut"}
                  value={logPath}
                  onChange={(e) => setLogPath(e.target.value)}
                />
                <button
                  className="btn"
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12 }}
                  onClick={pickLogFolder}
                  title="Choisir un dossier"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  Parcourir
                </button>
              </div>

              {logPath ? (
                <button
                  style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 11, padding: 0 }}
                  onClick={() => setLogPath("")}
                >
                  ✕ Réinitialiser (utiliser AppData)
                </button>
              ) : defaultLogPath ? (
                <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 6, marginBottom: 0 }}>
                  Chemin actuel : <code style={{ fontSize: 11 }}>{defaultLogPath}</code>
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Bottom actions (settings mode) ── */}
        {isSettings && (
          <div style={{ marginTop: 22, display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: "center", padding: "9px 0" }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {onClose && (
              <button
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center", padding: "9px 0" }}
                onClick={onClose}
              >
                Fermer sans enregistrer
              </button>
            )}
          </div>
        )}

        {saveMsg && (
          <p style={{ color: "var(--success, #22c55e)", fontSize: 12, marginTop: 10, textAlign: "center", marginBottom: 0 }}>
            ✓ {saveMsg}
          </p>
        )}
        {saveErr && (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            {saveErr}
          </p>
        )}
      </div>
    </div>
  );
}
