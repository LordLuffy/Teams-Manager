import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { DeviceCodeResult } from "../types";

interface Props {
  onSetup: () => void;
}

type Phase = "idle" | "polling";

export default function AuthScreen({ onSetup }: Props) {
  const [phase, setPhase]           = useState<Phase>("idle");
  const [deviceInfo, setDeviceInfo] = useState<DeviceCodeResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<DeviceCodeResult>("start_auth");
      setDeviceInfo(info);
      await openUrl(info.verification_uri);
      // Start polling in background — result arrives via "auth-ok" / "auth-error" event in App.tsx
      await invoke("poll_auth", { deviceCode: info.device_code, interval: info.interval });
      setPhase("polling");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen fade-in"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="card p-8 fade-in" style={{ width: "100%", maxWidth: 460 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "var(--accent-dim)",
            border: "1px solid rgba(59,130,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {/* Microsoft logo */}
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
              <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
              <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
              <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
          </div>
          <div>
            <h2 style={{ color: "var(--text-1)", fontSize: 17, fontWeight: 600, margin: 0 }}>
              Connexion Microsoft 365
            </h2>
            <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>
              Authentification par code appareil
            </p>
          </div>
        </div>

        {/* Phase idle */}
        {phase === "idle" && (
          <>
            <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.65, marginBottom: 22 }}>
              Cliquez sur le bouton ci-dessous pour démarrer l'authentification.
              Un code vous sera affiché pour le saisir sur la page Microsoft.
            </p>

            {error && (
              <div style={{
                background: "var(--danger-bg)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 7, padding: "10px 14px", marginBottom: 16,
              }}>
                <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "10px 0" }}
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <>
                  <SpinIcon />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LoginIcon />
                  Se connecter avec Microsoft
                </>
              )}
            </button>
          </>
        )}

        {/* Phase polling — device code displayed */}
        {phase === "polling" && deviceInfo && (
          <>
            <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 14 }}>
              Rendez-vous sur{" "}
              <strong style={{ color: "var(--info)" }}>aka.ms/devicelogin</strong>
              {" "}et saisissez ce code :
            </p>

            <div className="code-box" style={{ marginBottom: 18 }}>
              {deviceInfo.user_code}
            </div>

            <p style={{ color: "var(--text-3)", fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
              {deviceInfo.message}
            </p>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: "var(--info-bg)",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: 8,
            }}>
              <SpinIcon color="var(--info)" />
              <span style={{ color: "var(--info)", fontSize: 13 }}>
                En attente de l'authentification...
              </span>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onSetup}
            style={{
              background: "none", border: "none",
              color: "var(--text-3)", fontSize: 12,
              cursor: "pointer", padding: 0,
            }}
          >
            ← Modifier la configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function SpinIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2"
      style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
