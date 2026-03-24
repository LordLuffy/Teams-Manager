import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  version: string;
  notes?: string;
  onDismiss: () => void;
}

export default function UpdateBanner({ version, notes, onDismiss }: Props) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await invoke("install_update");
      // app.restart() est appelé côté Rust — cette ligne n'est jamais atteinte
    } catch (e) {
      setError(String(e));
      setInstalling(false);
    }
  };

  return (
    <div style={{
      margin: "0 8px 8px",
      borderRadius: 8,
      border: "1px solid rgba(96,165,250,0.35)",
      background: "rgba(96,165,250,0.07)",
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-1)", letterSpacing: "0.02em" }}>
            Mise à jour disponible
          </div>
          <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>
            v{version}
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: 13, padding: "0 2px",
            lineHeight: 1, flexShrink: 0,
          }}
          title="Ignorer"
        >
          ✕
        </button>
      </div>

      {/* Notes de version */}
      {notes && (
        <div style={{
          fontSize: 10, color: "var(--text-2)", maxHeight: 48,
          overflowY: "auto", lineHeight: 1.5, whiteSpace: "pre-wrap",
          borderTop: "1px solid rgba(96,165,250,0.18)", paddingTop: 6,
        }}>
          {notes}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{ fontSize: 10, color: "#f87171", lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onDismiss}
          disabled={installing}
          style={{ fontSize: 11, flex: 1 }}
        >
          Plus tard
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleInstall}
          disabled={installing}
          style={{ fontSize: 11, flex: 1 }}
        >
          {installing ? "Installation…" : "Installer"}
        </button>
      </div>
    </div>
  );
}
