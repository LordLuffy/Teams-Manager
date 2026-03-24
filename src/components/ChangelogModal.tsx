import { useState, useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
}

interface Props {
  appVersion: string;
  onClose: () => void;
}

export default function ChangelogModal({ appVersion, onClose }: Props) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/LordLuffy/Teams-Manager/releases?per_page=20")
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then((data: Release[]) => {
        setReleases(data);
        const current = data.find(r => r.tag_name === `v${appVersion}` || r.tag_name === appVersion);
        setExpandedTag(current?.tag_name ?? data[0]?.tag_name ?? null);
      })
      .catch(() => setError("Impossible de récupérer les notes de version."))
      .finally(() => setLoading(false));
  }, [appVersion]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 660, height: 800, display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "18px 24px 15px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Notes de version</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-3)" }}>Teams Manager</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 48 }}>
              <SpinIcon />
            </div>
          )}
          {error && (
            <p style={{ padding: "28px 24px", fontSize: 12, color: "var(--text-3)", textAlign: "center", margin: 0 }}>{error}</p>
          )}
          {!loading && !error && releases.length === 0 && (
            <p style={{ padding: "28px 24px", fontSize: 12, color: "var(--text-3)", textAlign: "center", margin: 0 }}>Aucune release publiée.</p>
          )}

          {releases.map(release => {
            const isExpanded = expandedTag === release.tag_name;
            const isCurrent = release.tag_name === `v${appVersion}` || release.tag_name === appVersion;
            return (
              <div key={release.tag_name} style={{ borderBottom: "1px solid var(--border)" }}>
                {/* Release row */}
                <button
                  onClick={() => setExpandedTag(isExpanded ? null : release.tag_name)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "13px 24px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                >
                  <ChevronIcon expanded={isExpanded} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                    {release.name || release.tag_name}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#60a5fa", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 5, padding: "2px 8px", flexShrink: 0, letterSpacing: "0.02em" }}>
                      actuelle
                    </span>
                  )}
                  {release.published_at && (
                    <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                      {new Date(release.published_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </button>

                {/* Release body */}
                {isExpanded && (
                  <div style={{ padding: "4px 24px 20px 46px" }}>
                    {renderMarkdown(release.body?.trim() || "Aucune note pour cette version.")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ flexShrink: 0, color: "var(--text-3)", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite", color: "var(--text-3)" }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

/** Inline: gras **text**, lien [texte](url) */
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
              style={{ color: "#60a5fa", textDecoration: "none", cursor: "pointer" }}
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

/** Block: ##, ###, listes, paragraphes */
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
    const t = line.trim();

    if (t.startsWith("## ")) {
      flushList();
      elements.push(
        <div key={key++} style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px", paddingBottom: 7, borderBottom: "1px solid rgba(96,165,250,0.25)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{t.slice(3)}</span>
        </div>
      );
    } else if (t.startsWith("### ")) {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: "10px 0 4px", fontSize: 13, fontWeight: 600, color: "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}>
          {t.slice(4)}
        </p>
      );
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      listItems.push(t.slice(2));
    } else if (t === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: "4px 0", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>
          {renderInline(t)}
        </p>
      );
    }
  }
  flushList();
  return <>{elements}</>;
}
