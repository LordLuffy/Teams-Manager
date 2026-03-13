import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onSaved: () => void;
}

export default function SetupScreen({ onSaved }: Props) {
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [err, setErr]           = useState("");
  const [saving, setSaving]     = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<{ tenant_id: string; client_id: string } | null>("load_config");
        if (cfg) {
          setTenantId(cfg.tenant_id ?? "");
          setClientId(cfg.client_id ?? "");
        }
      } catch (e) {
        console.error("load_config in setup:", e);
      }
    })();
  }, []);

  async function handleSubmit() {
    if (!tenantId.trim() || !clientId.trim()) {
      setErr("Les deux champs sont obligatoires.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await invoke("save_config", {
        config: { tenant_id: tenantId.trim(), client_id: clientId.trim() },
      });
      onSaved();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen fade-in"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="card p-8 fade-in" style={{ width: "100%", maxWidth: 460 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "var(--accent-dim)",
            border: "1px solid rgba(59,130,246,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 style={{ color: "var(--text-1)", fontSize: 18, fontWeight: 600, margin: 0 }}>
              Configuration initiale
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>
              Teams License &amp; Telephony Manager
            </p>
          </div>
        </div>

        {/* Azure AD instructions */}
        <div style={{
          background: "rgba(59,130,246,0.07)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 8, padding: "12px 14px", marginBottom: 22,
        }}>
          <p style={{ color: "var(--info)", fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 0 }}>
            Enregistrement Azure AD requis
          </p>
          <ol style={{ color: "var(--text-3)", fontSize: 12, paddingLeft: 16, lineHeight: 1.85, margin: 0 }}>
            <li>
              Allez sur{" "}
              <strong style={{ color: "var(--text-2)" }}>portal.azure.com</strong>
              {" "}→ App registrations → New registration
            </li>
            <li>Choisissez <em>Public client / native</em> comme type de plateforme</li>
            <li>
              Permissions API (déléguées) :{" "}
              <code style={{ color: "var(--info)" }}>User.Read.All</code>,{" "}
              <code style={{ color: "var(--info)" }}>Directory.Read.All</code>,{" "}
              <code style={{ color: "var(--info)" }}>Organization.Read.All</code>
            </li>
            <li>Dans Authentication, activez <em>Allow public client flows</em></li>
            <li>Copiez le Tenant ID et le Client (Application) ID ci-dessous</li>
          </ol>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
              Tenant ID
            </label>
            <input
              className="input"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: "block", color: "var(--text-2)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
              Client (Application) ID
            </label>
            <input
              className="input"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            />
          </div>
        </div>

        {err && (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{err}</p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 22, justifyContent: "center", padding: "10px 0" }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? "Enregistrement..." : "Enregistrer et continuer"}
        </button>
      </div>
    </div>
  );
}
