import { useState, useMemo } from "react";
import type { DashboardData, AutoAttendant, CallQueue, ResourceAccount } from "../../types";
import { useI18n } from "../../i18n";

interface Props { data: DashboardData; }

// ─── helpers ──────────────────────────────────────────────────────────────────

function lower(s: string) { return s.toLowerCase().trim(); }

function normalizePhone(p: string) {
  return p.replace(/[\s\-().]/g, "").replace(/^\+/, "").trim();
}

function truncLabel(s: string, max = 21): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Chain type ───────────────────────────────────────────────────────────────

interface Chain {
  phoneNumber: string;
  resourceAccount: ResourceAccount | null;
  entity: AutoAttendant | CallQueue | null;
  entityType: "aa" | "cq" | null;
}

// ─── Build chains ─────────────────────────────────────────────────────────────

function buildChains(data: DashboardData) {
  const { autoAttendants, callQueues, resourceAccounts, freeNumbers } = data;

  const aaByName = new Map<string, AutoAttendant>(autoAttendants.map((aa) => [lower(aa.name), aa]));
  const cqByName = new Map<string, CallQueue>(callQueues.map((cq) => [lower(cq.name), cq]));

  const chains: Chain[] = [];
  const linkedRaNames = new Set<string>();
  const linkedAaNames = new Set<string>();
  const linkedCqNames = new Set<string>();

  for (const ra of resourceAccounts) {
    const phones = ra.phoneNumber.split(",").map((p) => p.trim()).filter((p) => p && p !== "-");
    if (phones.length === 0) continue;
    linkedRaNames.add(lower(ra.displayName));

    const raNameL = lower(ra.displayName);
    let entity: AutoAttendant | CallQueue | null = null;
    let entityType: "aa" | "cq" | null = null;

    if (aaByName.has(raNameL)) {
      entity = aaByName.get(raNameL)!;
      entityType = "aa";
      linkedAaNames.add(raNameL);
    } else if (cqByName.has(raNameL)) {
      entity = cqByName.get(raNameL)!;
      entityType = "cq";
      linkedCqNames.add(raNameL);
    }

    for (const phone of phones) {
      chains.push({ phoneNumber: phone, resourceAccount: ra, entity, entityType });
    }
  }

  // Sort: group by entity, then by RA, then by phone
  chains.sort((a, b) => {
    const ea = a.entity?.name ?? "\uFFFF";
    const eb = b.entity?.name ?? "\uFFFF";
    if (ea !== eb) return ea.localeCompare(eb);
    const ra = a.resourceAccount?.displayName ?? "\uFFFF";
    const rb = b.resourceAccount?.displayName ?? "\uFFFF";
    if (ra !== rb) return ra.localeCompare(rb);
    return a.phoneNumber.localeCompare(b.phoneNumber);
  });

  const raPhoneSet = new Set<string>(
    resourceAccounts.flatMap((r) => r.phoneNumber.split(",").map((p) => normalizePhone(p.trim())))
  );
  const freeChains: Chain[] = freeNumbers
    .filter((fn) => { const n = normalizePhone(fn.number); return n && !raPhoneSet.has(n); })
    .map((fn) => ({ phoneNumber: fn.number, resourceAccount: null, entity: null, entityType: null }));

  const orphanAAs = autoAttendants.filter((aa) => !linkedAaNames.has(lower(aa.name))).map((aa) => aa.name);
  const orphanCQs = callQueues.filter((cq) => !linkedCqNames.has(lower(cq.name))).map((cq) => cq.name);

  return { chains, freeChains, orphanAAs, orphanCQs };
}

// ─── SVG graph constants & types ──────────────────────────────────────────────

const GC = {
  NODE_W: 172,
  NODE_H: 36,
  H_GAP:  72,
  V_GAP:  14,
  PAD_L:  14,
  PAD_T:  32,
  PAD_B:  16,
} as const;

const COL_X = [
  GC.PAD_L,
  GC.PAD_L + GC.NODE_W + GC.H_GAP,
  GC.PAD_L + 2 * (GC.NODE_W + GC.H_GAP),
];
const SVG_W = GC.PAD_L + 3 * GC.NODE_W + 2 * GC.H_GAP + GC.PAD_L;

type GNodeType = "phone" | "ra" | "aa" | "cq";

const G_COLORS: Record<GNodeType, { bg: string; border: string; text: string; pill: string }> = {
  phone: { bg: "rgba(16,185,129,0.09)",  border: "rgba(16,185,129,0.45)", text: "#10b981", pill: "rgba(16,185,129,0.55)"  },
  ra:    { bg: "rgba(96,165,250,0.09)",  border: "rgba(96,165,250,0.45)", text: "#60a5fa", pill: "rgba(96,165,250,0.55)"  },
  aa:    { bg: "rgba(167,139,250,0.09)", border: "rgba(167,139,250,0.45)",text: "#a78bfa", pill: "rgba(167,139,250,0.55)" },
  cq:    { bg: "rgba(251,191,36,0.09)",  border: "rgba(251,191,36,0.45)", text: "#f59e0b", pill: "rgba(251,191,36,0.55)"  },
};

interface GNode {
  id: string;
  label: string;
  type: GNodeType;
  col: number;
  rows: number[];   // chain row indices this node participates in
  unlicensed?: boolean;
}

interface GEdge { fromId: string; toId: string; }

function buildGraph(chains: Chain[]) {
  const nodesMap = new Map<string, GNode>();
  const edgesRaw: GEdge[] = [];

  chains.forEach((chain, i) => {
    const phoneId = `phone:${chain.phoneNumber}`;
    if (!nodesMap.has(phoneId)) {
      nodesMap.set(phoneId, { id: phoneId, label: chain.phoneNumber, type: "phone", col: 0, rows: [] });
    }
    nodesMap.get(phoneId)!.rows.push(i);

    if (chain.resourceAccount) {
      const raId = `ra:${chain.resourceAccount.upn}`;
      if (!nodesMap.has(raId)) {
        nodesMap.set(raId, {
          id: raId, label: chain.resourceAccount.displayName, type: "ra", col: 1, rows: [],
          unlicensed: chain.resourceAccount.licensed !== "Oui",
        });
      }
      nodesMap.get(raId)!.rows.push(i);
      edgesRaw.push({ fromId: phoneId, toId: raId });

      if (chain.entity) {
        const entityId = `${chain.entityType}:${chain.entity.name}`;
        if (!nodesMap.has(entityId)) {
          nodesMap.set(entityId, {
            id: entityId, label: chain.entity.name,
            type: chain.entityType as GNodeType, col: 2, rows: [],
          });
        }
        nodesMap.get(entityId)!.rows.push(i);
        edgesRaw.push({ fromId: raId, toId: entityId });
      }
    }
  });

  const seen = new Set<string>();
  const edges = edgesRaw.filter((e) => {
    const k = `${e.fromId}→${e.toId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { nodes: [...nodesMap.values()], edges };
}

function gNodeY(node: GNode): number {
  const avg = node.rows.reduce((a, b) => a + b, 0) / Math.max(1, node.rows.length);
  return GC.PAD_T + avg * (GC.NODE_H + GC.V_GAP) + GC.NODE_H / 2;
}

// ─── SVG node ─────────────────────────────────────────────────────────────────

function SvgNode({ node }: { node: GNode }) {
  const c = G_COLORS[node.type];
  const x = COL_X[node.col];
  const cy = gNodeY(node);
  const ty = cy - GC.NODE_H / 2;
  const PILL_LABELS: Record<GNodeType, string> = { phone: "NUM", ra: "RA", aa: "AA", cq: "CQ" };

  return (
    <g>
      <rect x={x} y={ty} width={GC.NODE_W} height={GC.NODE_H} rx={5}
        style={{ fill: c.bg, stroke: c.border, strokeWidth: 1.5 }} />
      {/* type pill */}
      <rect x={x + 6} y={ty + 9} width={26} height={15} rx={3} style={{ fill: c.pill }} />
      <text x={x + 19} y={ty + 20} textAnchor="middle"
        style={{ fontSize: 8, fontWeight: 700, fill: "white", fontFamily: "system-ui,sans-serif" }}>
        {PILL_LABELS[node.type]}
      </text>
      {/* label */}
      <text x={x + 40} y={ty + 22}
        style={{ fontSize: 11, fontWeight: 600, fill: c.text, fontFamily: "system-ui,sans-serif" }}>
        {truncLabel(node.label)}
      </text>
      {/* unlicensed warning for RA */}
      {node.unlicensed && (
        <text x={x + GC.NODE_W - 8} y={ty + 22} textAnchor="end"
          style={{ fontSize: 11, fill: "#f59e0b", fontFamily: "system-ui,sans-serif" }}>⚠</text>
      )}
    </g>
  );
}

// ─── SVG edge ─────────────────────────────────────────────────────────────────

function SvgEdge({ from, to }: { from: GNode; to: GNode }) {
  const x1 = COL_X[from.col] + GC.NODE_W;
  const y1 = gNodeY(from);
  const x2 = COL_X[to.col];
  const y2 = gNodeY(to);
  const mx = (x1 + x2) / 2;
  const ARR = 5;
  const c = G_COLORS[from.type];

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2 - ARR * 1.6} ${y2}`}
        fill="none"
        style={{ stroke: c.border, strokeWidth: 1.5 }}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ARR * 1.8},${y2 - ARR * 0.7} ${x2 - ARR * 1.8},${y2 + ARR * 0.7}`}
        style={{ fill: c.border }}
      />
    </g>
  );
}

// ─── Topo Graph component ─────────────────────────────────────────────────────

function TopoGraph({ chains, freeChains }: { chains: Chain[]; freeChains: Chain[] }) {
  const { t } = useI18n();
  const allChains = useMemo(() => [...chains, ...freeChains], [chains, freeChains]);

  if (allChains.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>{t("tabs.cartography.noChains")}</p>
      </div>
    );
  }

  const { nodes, edges } = useMemo(() => buildGraph(allChains), [allChains]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const svgH = GC.PAD_T + allChains.length * (GC.NODE_H + GC.V_GAP) + GC.PAD_B;
  const COL_LABELS = [t("tabs.cartography.colNumbers"), t("tabs.cartography.colResources"), t("tabs.cartography.colEntities")];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* hint */}
      <div style={{ background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ color: "var(--info)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          {t("tabs.cartography.graphHint")}
        </p>
      </div>

      {/* SVG */}
      <div style={{
        overflowX: "auto", overflowY: "auto",
        maxHeight: "calc(100vh - 240px)",
        border: "1px solid var(--border)", borderRadius: 8,
      }}>
        <svg
          width={SVG_W} height={svgH}
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          style={{ display: "block", background: "var(--bg-secondary)" }}
        >
          {/* Column headers */}
          {COL_LABELS.map((label, i) => (
            <text key={i}
              x={COL_X[i] + GC.NODE_W / 2} y={GC.PAD_T - 9}
              textAnchor="middle"
              style={{ fontSize: 9, fontWeight: 700, fill: "rgba(148,163,184,0.7)", fontFamily: "system-ui,sans-serif", letterSpacing: "0.05em" }}
            >
              {label.toUpperCase()}
            </text>
          ))}

          {/* Column separator lines */}
          {[1, 2].map((i) => (
            <line key={i}
              x1={COL_X[i] - GC.H_GAP / 2} y1={GC.PAD_T - 22}
              x2={COL_X[i] - GC.H_GAP / 2} y2={svgH - GC.PAD_B}
              style={{ stroke: "rgba(148,163,184,0.1)", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
          ))}

          {/* Edges (below nodes) */}
          {edges.map((e, i) => {
            const from = nodesById.get(e.fromId);
            const to = nodesById.get(e.toId);
            if (!from || !to) return null;
            return <SvgEdge key={i} from={from} to={to} />;
          })}

          {/* Nodes */}
          {nodes.map((n) => <SvgNode key={n.id} node={n} />)}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("tabs.cartography.legend")}</span>
        {(["phone", "ra", "aa", "cq"] as GNodeType[]).map((gtype) => {
          const labels: Record<GNodeType, string> = { phone: t("tabs.cartography.legendPhone"), ra: t("tabs.cartography.legendRa"), aa: t("tabs.cartography.legendAa"), cq: t("tabs.cartography.legendCq") };
          const c = G_COLORS[gtype];
          return (
            <span key={gtype} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px 2px 5px", borderRadius: 20, fontSize: 11, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
              <span style={{ width: 18, height: 14, borderRadius: 3, background: c.pill, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "#fff" }}>
                {{ phone: "NUM", ra: "RA", aa: "AA", cq: "CQ" }[gtype]}
              </span>
              {labels[gtype]}
            </span>
          );
        })}
        <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 4 }}>⚠ = {t("tabs.cartography.raNoLicense")}</span>
      </div>
    </div>
  );
}

// ─── Liste view: icons ────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function QueueIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Liste view: cards ────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "3px 9px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  whiteSpace: "nowrap", border: "1px solid",
};

function PhoneCard({ number }: { number: string }) {
  return <span style={{ ...cardBase, background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)", color: "#10b981" }}><PhoneIcon />{number}</span>;
}
function RACard({ ra }: { ra: ResourceAccount }) {
  return (
    <span style={{ ...cardBase, background: "rgba(96,165,250,0.08)", borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}>
      <UserIcon />{ra.displayName}
      {ra.licensed !== "Oui" && <span style={{ marginLeft: 2, fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>⚠</span>}
    </span>
  );
}
function AACard({ aa }: { aa: AutoAttendant }) {
  return <span style={{ ...cardBase, background: "rgba(167,139,250,0.08)", borderColor: "rgba(167,139,250,0.3)", color: "#a78bfa" }}><MenuIcon />{aa.name}</span>;
}
function CQCard({ cq }: { cq: CallQueue }) {
  return <span style={{ ...cardBase, background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.3)", color: "#f59e0b" }}><QueueIcon />{cq.name}</span>;
}

// ─── Liste view: detail panels ────────────────────────────────────────────────

function flowLabel(flow: string) {
  return flow.replace("Transferer ->", "Transférer →").replace("Deconnecter", "Déconnecter");
}

function AADetail({ aa }: { aa: AutoAttendant }) {
  const { t } = useI18n();
  const weekOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const sorted = weekOrder.map((d) => aa.businessHours?.find((h) => h.day === d)).filter(Boolean) as typeof aa.businessHours;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {aa.defaultCallFlow && aa.defaultCallFlow !== "N/A" && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(96,165,250,0.05)", borderLeft: "3px solid rgba(96,165,250,0.5)", flex: 1, minWidth: 140 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.03em" }}>{t("tabs.cartography.flowBusiness")}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{flowLabel(aa.defaultCallFlow)}</p>
          </div>
        )}
        {aa.afterHoursCallFlow && aa.afterHoursCallFlow !== "N/A" && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(245,158,11,0.05)", borderLeft: "3px solid rgba(245,158,11,0.5)", flex: 1, minWidth: 140 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.03em" }}>{t("tabs.cartography.flowAfterHours")}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{flowLabel(aa.afterHoursCallFlow)}</p>
          </div>
        )}
        {aa.timeZone && aa.timeZone !== "N/A" && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(148,163,184,0.05)", borderLeft: "3px solid rgba(148,163,184,0.35)", minWidth: 100 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.03em" }}>{t("tabs.cartography.timezoneLabel")}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{aa.timeZone}</p>
          </div>
        )}
      </div>
      {sorted && sorted.length > 0 && (
        <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(16,185,129,0.05)", borderLeft: "3px solid rgba(16,185,129,0.4)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "#10b981", letterSpacing: "0.03em" }}>{t("tabs.cartography.schedule")}</p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {sorted.map((dh) => {
              const closed = dh.hours === "Fermee" || dh.hours === "Fermée";
              return (
                <div key={dh.day} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  minWidth: 64, padding: "4px 8px", borderRadius: 5, gap: 2,
                  background: closed ? "var(--bg-secondary)" : "rgba(96,165,250,0.08)",
                  border: `1px solid ${closed ? "var(--border)" : "rgba(96,165,250,0.25)"}`,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.04em" }}>{dh.day.slice(0, 3).toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: closed ? "var(--text-3)" : "var(--text-1)", whiteSpace: "nowrap" }}>{closed ? t("tabs.cartography.closed") : dh.hours}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CQDetail({ cq }: { cq: CallQueue }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {cq.routingMethod && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(148,163,184,0.05)", borderLeft: "3px solid rgba(148,163,184,0.35)", minWidth: 110 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.03em" }}>{t("tabs.cartography.routing")}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{cq.routingMethod}</p>
          </div>
        )}
        {cq.timeoutAction && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(245,158,11,0.05)", borderLeft: "3px solid rgba(245,158,11,0.4)", minWidth: 110 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.03em" }}>TIMEOUT</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{cq.timeoutAction}</p>
          </div>
        )}
        {cq.overflowAction && (
          <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(239,68,68,0.05)", borderLeft: "3px solid rgba(239,68,68,0.4)", minWidth: 110 }}>
            <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.03em" }}>{t("tabs.cartography.overflow")}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-1)" }}>{cq.overflowAction}</p>
          </div>
        )}
      </div>
      {cq.agents && cq.agents.length > 0 && (
        <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(96,165,250,0.05)", borderLeft: "3px solid rgba(96,165,250,0.45)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.03em" }}>{t("tabs.cartography.agents")} ({cq.agents.length})</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cq.agents.map((a, i) => (
              <span key={i} style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>{a}</span>
            ))}
          </div>
        </div>
      )}
      {cq.distributionLists && cq.distributionLists.length > 0 && (
        <div style={{ padding: "7px 11px", borderRadius: 6, background: "rgba(167,139,250,0.05)", borderLeft: "3px solid rgba(167,139,250,0.45)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.03em" }}>{t("tabs.cartography.groups")} ({cq.distributionLists.length})</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cq.distributionLists.map((dl, i) => (
              <span key={i} style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>{dl}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chain row ────────────────────────────────────────────────────────────────

function ChainRow({ chain }: { chain: Chain }) {
  const [open, setOpen] = useState(false);
  const hasDetail = chain.entity !== null;

  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", cursor: hasDetail ? "pointer" : "default", userSelect: "none" }}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", flex: 1, flexWrap: "wrap", rowGap: 5 }}>
          <PhoneCard number={chain.phoneNumber} />
          {chain.resourceAccount && <><span style={{ color: "var(--text-3)", fontSize: 15, margin: "0 4px" }}>→</span><RACard ra={chain.resourceAccount} /></>}
          {chain.entity && chain.entityType === "aa" && <><span style={{ color: "var(--text-3)", fontSize: 15, margin: "0 4px" }}>→</span><AACard aa={chain.entity as AutoAttendant} /></>}
          {chain.entity && chain.entityType === "cq" && <><span style={{ color: "var(--text-3)", fontSize: 15, margin: "0 4px" }}>→</span><CQCard cq={chain.entity as CallQueue} /></>}
        </div>
        {hasDetail && <span style={{ color: "var(--text-3)", marginLeft: 8, flexShrink: 0 }}><ChevronDown open={open} /></span>}
      </div>
      {open && hasDetail && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}>
          {chain.entityType === "aa"
            ? <AADetail aa={chain.entity as AutoAttendant} />
            : <CQDetail cq={chain.entity as CallQueue} />
          }
        </div>
      )}
    </div>
  );
}

// ─── Orphan section ───────────────────────────────────────────────────────────

function OrphanSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", userSelect: "none", background: "var(--bg-secondary)" }}
        onClick={() => setOpen((o) => !o)}>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{title}</span>
        <span className="badge" style={{ fontSize: 11 }}>{items.length}</span>
        <span style={{ marginLeft: "auto", color: "var(--text-3)" }}><ChevronDown open={open} /></span>
      </div>
      {open && (
        <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 5 }}>
          {items.map((name) => (
            <span key={name} style={{ ...cardBase, background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-2)" }}>{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Liste view ───────────────────────────────────────────────────────────────

interface ListeViewProps {
  chains: Chain[];
  freeChains: Chain[];
  orphanAAs: string[];
  orphanCQs: string[];
}

function ListeView({ chains, freeChains, orphanAAs, orphanCQs }: ListeViewProps) {
  const { t } = useI18n();
  const total = chains.length + freeChains.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Info */}
      <div style={{ background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "11px 14px" }}>
        <p style={{ color: "var(--info)", fontSize: 13, margin: 0, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: t("tabs.cartography.listInfo") }} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("tabs.cartography.legend")}</span>
        <span style={{ ...cardBase, background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)", color: "#10b981", fontSize: 11 }}><PhoneIcon />{t("tabs.cartography.legendPhone")}</span>
        <span style={{ ...cardBase, background: "rgba(96,165,250,0.08)", borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa", fontSize: 11 }}><UserIcon />{t("tabs.cartography.legendRa")}</span>
        <span style={{ ...cardBase, background: "rgba(167,139,250,0.08)", borderColor: "rgba(167,139,250,0.3)", color: "#a78bfa", fontSize: 11 }}><MenuIcon />{t("tabs.cartography.legendAa")}</span>
        <span style={{ ...cardBase, background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.3)", color: "#f59e0b", fontSize: 11 }}><QueueIcon />{t("tabs.cartography.legendCq")}</span>
        <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>{total} {total > 1 ? t("tabs.cartography.chainPlural") : t("tabs.cartography.chainSingular")}</span>
      </div>

      {/* Chains with RA */}
      {chains.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {chains.map((chain, i) => <ChainRow key={`${chain.phoneNumber}-${i}`} chain={chain} />)}
        </div>
      )}

      {/* Free numbers */}
      {freeChains.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <p style={{ margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{t("tabs.cartography.freeNumbers")}</p>
          {freeChains.map((chain, i) => <ChainRow key={`free-${chain.phoneNumber}-${i}`} chain={chain} />)}
        </div>
      )}

      {total === 0 && (
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>{t("tabs.cartography.noChains")}</p>
      )}

      {/* Orphans */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
        <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{t("tabs.cartography.orphanTitle")}</p>
        <OrphanSection title={t("tabs.cartography.orphanAAs")} items={orphanAAs} color="#a78bfa" />
        <OrphanSection title={t("tabs.cartography.orphanCQs")} items={orphanCQs} color="#f59e0b" />
      </div>
    </div>
  );
}

// ─── Sub-tab button ────────────────────────────────────────────────────────────

function SubTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--accent, #3b82f6)" : "var(--text-2)",
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--accent, #3b82f6)" : "transparent"}`,
        cursor: "pointer",
        transition: "color .15s, border-color .15s",
        marginBottom: "-1px",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CartographieTab({ data }: Props) {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<"liste" | "graphe">("liste");

  const { chains, freeChains, orphanAAs, orphanCQs } = useMemo(
    () => buildChains(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Sub-tab header */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
        <SubTabBtn active={subTab === "liste"} onClick={() => setSubTab("liste")}>
          {t("tabs.cartography.listTab")}
        </SubTabBtn>
        <SubTabBtn active={subTab === "graphe"} onClick={() => setSubTab("graphe")}>
          {t("tabs.cartography.graphTab")}
        </SubTabBtn>
      </div>

      {subTab === "liste"
        ? <ListeView chains={chains} freeChains={freeChains} orphanAAs={orphanAAs} orphanCQs={orphanCQs} />
        : <TopoGraph chains={chains} freeChains={freeChains} />
      }
    </div>
  );
}
