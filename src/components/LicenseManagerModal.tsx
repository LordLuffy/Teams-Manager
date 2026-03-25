import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Subscription, DirectoryUser, UserLicense } from "../types";
import { useI18n } from "../i18n";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sub: Subscription;
  allUsers: DirectoryUser[];
  userLicenses: UserLicense[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
        style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        className="input"
        style={{ paddingLeft: 30, fontSize: 12, height: 30 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="…"
      />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LicenseManagerModal({ sub, allUsers, userLicenses, onClose, onSaved }: Props) {
  const { t } = useI18n();

  // Pending changes
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());

  // Search filters
  const [searchWith, setSearchWith] = useState("");
  const [searchWithout, setSearchWithout] = useState("");

  // Submit state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  // Derived sets
  const upnsWithLicense = useMemo(() => {
    return new Set(
      userLicenses.filter(l => l.skuPartNumber === sub.sku).map(l => l.upn)
    );
  }, [userLicenses, sub.sku]);

  const withLicense = useMemo(
    () => allUsers.filter(u => upnsWithLicense.has(u.upn)),
    [allUsers, upnsWithLicense]
  );
  const withoutLicense = useMemo(
    () => allUsers.filter(u => !upnsWithLicense.has(u.upn)),
    [allUsers, upnsWithLicense]
  );

  // Filtered lists for search
  const filteredWith = withLicense.filter(u =>
    u.displayName.toLowerCase().includes(searchWith.toLowerCase()) ||
    u.upn.toLowerCase().includes(searchWith.toLowerCase())
  );
  const filteredWithout = withoutLicense.filter(u =>
    u.displayName.toLowerCase().includes(searchWithout.toLowerCase()) ||
    u.upn.toLowerCase().includes(searchWithout.toLowerCase())
  );

  function toggleRemove(upn: string) {
    setPendingRemove(prev => {
      const next = new Set(prev);
      if (next.has(upn)) next.delete(upn); else next.add(upn);
      return next;
    });
  }

  function toggleAdd(upn: string) {
    setPendingAdd(prev => {
      const next = new Set(prev);
      if (next.has(upn)) next.delete(upn); else next.add(upn);
      return next;
    });
  }

  async function handleSave() {
    if (pendingAdd.size === 0 && pendingRemove.size === 0) {
      setErrors([t("tabs.subscriptions.licenseManager.noChanges")]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const result = await invoke<string[]>("manage_licenses", {
        upnsToAdd: [...pendingAdd],
        upnsToRemove: [...pendingRemove],
        skuId: sub.skuId,
      });
      if (result.length === 0) {
        setDone(true);
        onSaved(); // triggers background refresh in parent — does NOT close the modal
      } else {
        setErrors(result);
      }
    } catch (e) {
      setErrors([String(e)]);
    } finally {
      setSaving(false);
    }
  }

  const pendingAddCount = pendingAdd.size;
  const pendingRemoveCount = pendingRemove.size;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, width: 760, height: 560, display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                {t("tabs.subscriptions.licenseManager.title")} — {sub.friendlyName}
              </h2>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>{sub.sku}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18, padding: 4, lineHeight: 1, borderRadius: 6 }}>✕</button>
        </div>

        {/* ── Panels ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Left: with license */}
          <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "14px 16px", overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
              {t("tabs.subscriptions.licenseManager.withLicense")} ({withLicense.length})
            </div>
            <SearchInput value={searchWith} onChange={setSearchWith} />
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredWith.length === 0 ? (
                <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>{t("tabs.subscriptions.licenseManager.noUsers")}</p>
              ) : filteredWith.map(u => {
                const isPending = pendingRemove.has(u.upn);
                return (
                  <div key={u.upn} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "5px 8px", borderRadius: 6, fontSize: 12,
                    background: isPending ? "rgba(245,158,11,0.12)" : "transparent",
                    border: isPending ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--text-1)", fontWeight: 500, textDecoration: isPending ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.displayName}</div>
                      <div style={{ color: "var(--text-3)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.upn}</div>
                    </div>
                    <button
                      onClick={() => toggleRemove(u.upn)}
                      style={{
                        flexShrink: 0, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                        background: isPending ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.12)",
                        color: isPending ? "var(--warning)" : "var(--danger)",
                      }}
                    >
                      {isPending ? "↩" : "−"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: without license */}
          <div style={{ display: "flex", flexDirection: "column", padding: "14px 16px", overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
              {t("tabs.subscriptions.licenseManager.withoutLicense")} ({withoutLicense.length})
            </div>
            <SearchInput value={searchWithout} onChange={setSearchWithout} />
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredWithout.length === 0 ? (
                <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>{t("tabs.subscriptions.licenseManager.noUsers")}</p>
              ) : filteredWithout.map(u => {
                const isPending = pendingAdd.has(u.upn);
                return (
                  <div key={u.upn} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "5px 8px", borderRadius: 6, fontSize: 12,
                    background: isPending ? "rgba(34,197,94,0.1)" : "transparent",
                    border: isPending ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--text-1)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.displayName}</div>
                      <div style={{ color: "var(--text-3)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.upn}</div>
                    </div>
                    <button
                      onClick={() => toggleAdd(u.upn)}
                      style={{
                        flexShrink: 0, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                        background: isPending ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.12)",
                        color: "var(--success)",
                      }}
                    >
                      {isPending ? "↩" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Success / Error feedback ── */}
        {done && (
          <div style={{ margin: "8px 16px", padding: "8px 12px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, color: "var(--success)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            ✓ {t("tabs.subscriptions.licenseManager.successMsg")}
          </div>
        )}
        {errors.length > 0 && (
          <div style={{ margin: "8px 16px", padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, maxHeight: 90, overflowY: "auto", flexShrink: 0 }}>
            <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              {t("tabs.subscriptions.licenseManager.errorPartial").replace("{n}", String(errors.length))}
            </div>
            {errors.map((e, i) => (
              <div key={i} style={{ color: "var(--danger)", fontSize: 11, fontFamily: "monospace" }}>{e}</div>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 12, color: "var(--text-3)", fontSize: 12 }}>
            {pendingAddCount > 0 && (
              <span style={{ color: "var(--success)", fontWeight: 600 }}>
                ✓ {t("tabs.subscriptions.licenseManager.pendingAdd").replace("{n}", String(pendingAddCount))}
              </span>
            )}
            {pendingRemoveCount > 0 && (
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                ⚠ {t("tabs.subscriptions.licenseManager.pendingRemove").replace("{n}", String(pendingRemoveCount))}
              </span>
            )}
            {pendingAddCount === 0 && pendingRemoveCount === 0 && (
              <span style={{ fontStyle: "italic" }}>—</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {done || errors.length > 0 ? (
              <button className="btn" onClick={onClose} style={{ minWidth: 80, justifyContent: "center" }}>
                {t("tabs.subscriptions.licenseManager.close")}
              </button>
            ) : (
              <>
                <button className="btn" onClick={onClose} disabled={saving} style={{ minWidth: 80, justifyContent: "center" }}>
                  {t("tabs.subscriptions.licenseManager.cancel")}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 80, justifyContent: "center" }}>
                  {saving ? t("tabs.subscriptions.licenseManager.saving") : t("tabs.subscriptions.licenseManager.save")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
