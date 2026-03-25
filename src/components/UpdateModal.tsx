import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useI18n } from "../i18n";

interface Props {
  version: string;
  notes?: string;
  onClose: () => void;
}

export default function UpdateModal({ version, notes, onClose }: Props) {
  const { t } = useI18n();
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
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 580, height: 480, display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <DownloadCloudIcon />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>
                {t("update.available")}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>Teams Manager</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                  color: "#60a5fa", background: "rgba(96,165,250,0.12)",
                  border: "1px solid rgba(96,165,250,0.3)", borderRadius: 5,
                  padding: "1px 8px", letterSpacing: "0.03em",
                }}>
                  v{version}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}
          >
            ✕
          </button>
        </div>

        {/* ── Sous-titre "Nouveautés" ── */}
        <div style={{ padding: "14px 24px 0", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("update.whatsNew")}
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 24px 12px" }}>
          {notes
            ? renderMarkdown(notes.trim())
            : <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)" }}>{t("update.noNotes")}</p>
          }
        </div>

        {/* ── Erreur ── */}
        {error && (
          <div style={{ padding: "0 24px 8px", flexShrink: 0 }}>
            <p style={{
              margin: 0, fontSize: 11, color: "#f87171",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 6, padding: "8px 12px",
            }}>
              {error}
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "12px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={installing}>
            {t("update.later")}
          </button>
          <button className="btn btn-primary" onClick={handleInstall} disabled={installing}>
            {installing
              ? <><SpinIcon />{t("update.installing")}</>
              : <><DownloadIcon />{t("update.install")}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function DownloadCloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Markdown renderer (identique à ChangelogModal) ─────────────────────────────

function renderInline(text: string): React.ReactNode {
  const tokenRe = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRe);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ color: "var(--text-1)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <span key={i}
              onClick={() => openUrl(link[2])}
              style={{ color: "#60a5fa", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
            >
              {link[1]}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: "4px 0 10px", paddingLeft: 0, listStyle: "none" }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 3 }}>
            <span style={{ color: "var(--text-3)", marginTop: 2, flexShrink: 0, fontSize: 10 }}>●</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const l = line.trim();
    if (l.startsWith("## ")) {
      flushList();
      elements.push(
        <div key={key++} style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px", paddingBottom: 7, borderBottom: "1px solid rgba(96,165,250,0.2)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>{l.slice(3)}</span>
        </div>
      );
    } else if (l.startsWith("### ")) {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: "10px 0 4px", fontSize: 12.5, fontWeight: 600, color: "#a78bfa" }}>
          {l.slice(4)}
        </p>
      );
    } else if (l.startsWith("- ") || l.startsWith("* ")) {
      listItems.push(l.slice(2));
    } else if (l === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: "4px 0", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>
          {renderInline(l)}
        </p>
      );
    }
  }
  flushList();
  return <>{elements}</>;
}
