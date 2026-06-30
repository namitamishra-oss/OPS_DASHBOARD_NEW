"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, ReactNode,
} from "react";
import { useTheme } from "@/lib/theme-context";

// ── Types ─────────────────────────────────────────────────────────────────────
export type TimeRange =
  | { type: "hours"; value: number; label: string }
  | { type: "days";  value: number; label: string }
  | { type: "custom"; from: string; to: string; label: string };

export type RefreshInterval = { seconds: number; label: string };

export const TIME_RANGES: TimeRange[] = [
  { type: "hours", value: 1,  label: "Last 1 hour"  },
  { type: "hours", value: 6,  label: "Last 6 hours" },
  { type: "hours", value: 12, label: "Last 12 hours"},
  { type: "hours", value: 24, label: "Last 24 hours"},
  { type: "hours", value: 48, label: "Last 48 hours"},
  { type: "days",  value: 7,  label: "Last 7 days"  },
  { type: "days",  value: 14, label: "Last 14 days" },
  { type: "days",  value: 30, label: "Last 30 days" },
];

export const REFRESH_INTERVALS: RefreshInterval[] = [
  { seconds: 0,   label: "Manual only" },
  { seconds: 10,  label: "10 seconds"  },
  { seconds: 30,  label: "30 seconds"  },
  { seconds: 60,  label: "1 minute"    },
  { seconds: 300, label: "5 minutes"   },
];

// ── Context ───────────────────────────────────────────────────────────────────
interface DashCtx {
  timeRange:         TimeRange;
  setTimeRange:      (r: TimeRange) => void;
  refreshInterval:   RefreshInterval;
  setRefreshInterval:(r: RefreshInterval) => void;
  refreshTick:       number;
  triggerRefresh:    () => void;
  toApiParams:       () => { hours?: number; days?: number; from?: string; to?: string };
}

const Ctx = createContext<DashCtx | null>(null);

export function useDashboardControls(): DashCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardControls must be inside DashboardControlsProvider");
  return ctx;
}

export function DashboardControlsProvider({ children }: { children: ReactNode }) {
  const [timeRange,       setTimeRange]       = useState<TimeRange>(TIME_RANGES[3]);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(REFRESH_INTERVALS[1]);
  const [refreshTick,     setRefreshTick]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    clearInterval(timerRef.current);
    if (refreshInterval.seconds > 0) {
      timerRef.current = setInterval(() => setRefreshTick(t => t + 1), refreshInterval.seconds * 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [refreshInterval.seconds]);

  const triggerRefresh = useCallback(() => setRefreshTick(t => t + 1), []);

  const toApiParams = useCallback(() => {
    if (timeRange.type === "hours")  return { hours: timeRange.value };
    if (timeRange.type === "days")   return { days:  timeRange.value };
    if (timeRange.type === "custom") return { from:  timeRange.from, to: timeRange.to };
    return { hours: 24 };
  }, [timeRange]);

  return (
    <Ctx.Provider value={{ timeRange, setTimeRange, refreshInterval, setRefreshInterval, refreshTick, triggerRefresh, toApiParams }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Topbar component ──────────────────────────────────────────────────────────
// Nav items removed — sidebar handles all navigation
// Topbar only has: brand logo + right controls (time range, refresh, clock, theme, signout)
const THEME_OPTIONS = [
  { value: "light"  as const, icon: "☀️", label: "Light"  },
  { value: "dark"   as const, icon: "🌙", label: "Dark"   },
  { value: "system" as const, icon: "💻", label: "System" },
];

export default function Topbar() {
  const { data: session }       = useSession();
  const { mode, resolved, setMode } = useTheme();
  const { timeRange, setTimeRange, refreshInterval, setRefreshInterval, refreshTick, triggerRefresh } = useDashboardControls();

  const [time,        setTime]        = useState("");
  const [countdown,   setCountdown]   = useState(0);
  const [showTheme,   setShowTheme]   = useState(false);
  const [showTime,    setShowTime]    = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [showCustom,  setShowCustom]  = useState(false);
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState("");
  const [signingOut,  setSigningOut]  = useState(false);

  const themeRef   = useRef<HTMLDivElement>(null);
  const timeRef    = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  // Countdown
  useEffect(() => {
    if (refreshInterval.seconds === 0) { setCountdown(0); return; }
    setCountdown(refreshInterval.seconds);
    const id = setInterval(() => setCountdown(c => c <= 1 ? refreshInterval.seconds : c - 1), 1000);
    return () => clearInterval(id);
  }, [refreshInterval.seconds, refreshTick]);

  // Outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (themeRef.current   && !themeRef.current.contains(e.target as Node))   setShowTheme(false);
      if (timeRef.current    && !timeRef.current.contains(e.target as Node))    { setShowTime(false); setShowCustom(false); }
      if (refreshRef.current && !refreshRef.current.contains(e.target as Node)) setShowRefresh(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isDark = resolved === "dark";
  const today  = new Date().toLocaleDateString("en-CA");

  // ── Color tokens — improved readability ───────────────────────────────────
  const C = {
    bg:          isDark ? "#13161f" : "#1a1d2e",
    border:      isDark ? "#2a2d3e" : "#252840",
    text:        "#e8eaf2",          // always light — bar is always dark
    muted:       "#9ba3c2",
    active:      "#1db99f",
    activeBg:    "rgba(29,185,159,0.15)",
    dropBg:      isDark ? "#1e2130" : "#ffffff",
    dropBorder:  isDark ? "#2a2d3e" : "#e5e7eb",
    dropText:    isDark ? "#e8eaf2" : "#111827",
    dropMuted:   isDark ? "#6b7080" : "#9ca3af",
    inputBg:     isDark ? "#0d1117" : "#111827",
    inputBorder: isDark ? "#2a2d3e" : "#374151",
    inputText:   "#e8eaf2",
  };

  const dropStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    position: "absolute", top: 46, right: 0,
    background: C.dropBg, border: `1px solid ${C.dropBorder}`,
    borderRadius: 10, padding: 6,
    boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
    zIndex: 200, minWidth: 210, ...extra,
  });

  const dropItem = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    width: "100%", padding: "8px 10px", borderRadius: 7, border: "none",
    background: active ? "rgba(29,185,159,0.12)" : "transparent",
    color: active ? "#1db99f" : C.dropText,
    cursor: "pointer", fontSize: 12.5, fontWeight: active ? 600 : 400, textAlign: "left",
  });

  const ctrlBtn = (active = false): React.CSSProperties => ({
    background:  active ? C.activeBg : "rgba(255,255,255,0.06)",
    border:      `1px solid ${active ? "rgba(29,185,159,0.4)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 6, cursor: "pointer",
    color:  active ? C.active : C.text,
    fontSize: 12, fontWeight: active ? 700 : 500,
    padding: "4px 10px",
    display: "flex", alignItems: "center", gap: 5,
    whiteSpace: "nowrap", letterSpacing: "0.02em",
    transition: "all 0.12s",
  });

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    // date input gives "YYYY-MM-DD" — append full day times for ClickHouse DateTime64
    const normFrom = customFrom + ' 00:00:00'
    const normTo   = customTo   + ' 23:59:59'
    const label    = `${customFrom.slice(5)} → ${customTo.slice(5)}`
    setTimeRange({ type: "custom", from: normFrom, to: normTo, label });
    triggerRefresh();
    setShowCustom(false); setShowTime(false);
  };

  const dateInputStyle: React.CSSProperties = {
    width: "100%", fontSize: 11.5, padding: "5px 8px", borderRadius: 6,
    border: `1px solid ${C.inputBorder}`, background: C.inputBg,
    color: C.inputText, outline: "none", fontFamily: "inherit",
    colorScheme: "dark",
  };

  const countdownColor = countdown <= 5 && countdown > 0 && refreshInterval.seconds > 0 ? "#f59e0b" : C.muted;

  return (
    <>
      <header style={{
        height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 16px",
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 16, borderRight: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: "#1a9e8c", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>G</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
            GoFlipo<span style={{ color: C.muted, fontWeight: 400 }}>/</span>Support
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Time range */}
          <div ref={timeRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowTime(v => !v); setShowRefresh(false); setShowTheme(false); }} style={ctrlBtn(true)}>
              <span style={{ fontSize: 13 }}>📅</span>
              <span style={{ color: C.active }}>{timeRange.label}</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
            </button>
            {showTime && (
              <div style={dropStyle({ minWidth: 250 })}>
                <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: C.dropMuted, padding: "4px 10px 8px", textTransform: "uppercase" }}>Time Range</p>
                {TIME_RANGES.map(r => {
                  const isAct = timeRange.type !== "custom" && timeRange.type === r.type && (timeRange as any).value === (r as any).value;
                  return (
                    <button key={r.label} onClick={() => { setTimeRange(r); setShowTime(false); setShowCustom(false); triggerRefresh(); }} style={dropItem(isAct)}>
                      <span>{r.label}</span>
                      {isAct && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1db99f", display: "inline-block" }} />}
                    </button>
                  );
                })}
                <div style={{ height: 1, background: C.dropBorder, margin: "6px 4px" }} />
                <button onClick={() => setShowCustom(v => !v)} style={dropItem(timeRange.type === "custom")}>
                  <span>✏️ Custom range…</span>
                  <span style={{ fontSize: 10 }}>{showCustom ? "▲" : "▶"}</span>
                </button>
                {showCustom && (
                  <div style={{ padding: "10px 10px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.dropMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>From date</div>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={dateInputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.dropMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>To date</div>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={dateInputStyle} />
                    </div>
                    <button onClick={applyCustomRange} disabled={!customFrom || !customTo}
                      style={{ padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", background: "#1a9e8c", color: "#fff", fontSize: 12, fontWeight: 700, opacity: (!customFrom || !customTo) ? 0.4 : 1 }}>
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refresh */}
          <div ref={refreshRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowRefresh(v => !v); setShowTime(false); setShowTheme(false); }} style={ctrlBtn(false)} title="Auto-refresh">
              <span style={{ fontSize: 13 }}>↻</span>
              {refreshInterval.seconds === 0
                ? <span style={{ color: C.muted }}>Manual</span>
                : <span style={{ color: countdownColor, fontFamily: "monospace", fontSize: 11 }}>{countdown}s</span>
              }
              <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
            </button>
            {showRefresh && (
              <div style={dropStyle({ minWidth: 190 })}>
                <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: C.dropMuted, padding: "4px 10px 8px", textTransform: "uppercase" }}>Auto-Refresh</p>
                {REFRESH_INTERVALS.map(r => {
                  const isAct = refreshInterval.seconds === r.seconds;
                  return (
                    <button key={r.label} onClick={() => { setRefreshInterval(r); setShowRefresh(false); }} style={dropItem(isAct)}>
                      <span>{r.label}</span>
                      {isAct && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1db99f", display: "inline-block" }} />}
                    </button>
                  );
                })}
                <div style={{ height: 1, background: C.dropBorder, margin: "6px 4px" }} />
                <button onClick={() => { triggerRefresh(); setShowRefresh(false); }} style={dropItem(false)}>
                  <span>↻ Refresh now</span>
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

          {/* Clock */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1db99f", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: C.text, fontFamily: "monospace" }}>{time}</span>
            <span style={{ fontSize: 11, color: C.muted }}>·</span>
            <span style={{ fontSize: 11, color: C.muted }}>{today}</span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

          {/* Theme */}
          <div ref={themeRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowTheme(v => !v); setShowTime(false); setShowRefresh(false); }}
              title="Theme" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "4px 6px", borderRadius: 5, lineHeight: 1 }}>
              {mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "💻"}
            </button>
            {showTheme && (
              <div style={dropStyle({ minWidth: 150 })}>
                <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: C.dropMuted, padding: "4px 10px 8px", textTransform: "uppercase" }}>Appearance</p>
                {THEME_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setMode(opt.value); setShowTheme(false); }} style={dropItem(mode === opt.value)}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </span>
                    {mode === opt.value && <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#1db99f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />

          {/* User + sign out */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {session?.user?.name && (
              <span style={{ fontSize: 11, color: C.muted, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.name}
              </span>
            )}
            <button onClick={() => { setSigningOut(true); signOut({ callbackUrl: "/login" }); }} disabled={signingOut}
              style={{ background: signingOut ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)", border: `1px solid ${signingOut ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, cursor: signingOut ? "default" : "pointer", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", color: signingOut ? "#ef4444" : C.muted, padding: "4px 10px", whiteSpace: "nowrap" }}>
              {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
            </button>
          </div>
        </div>
      </header>
      <div style={{ height: 48 }} />
    </>
  );
}
