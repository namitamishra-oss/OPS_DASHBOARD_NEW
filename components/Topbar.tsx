"use client"; 

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { useTheme } from "@/lib/theme-context";

// ══════════════════════════════════════════════════════════════════════════════
// Global time-range + refresh context — any page can read these
// ══════════════════════════════════════════════════════════════════════════════
export type TimeRange =
  | { type: "hours"; value: number; label: string }
  | { type: "days"; value: number; label: string }
  | { type: "custom"; from: string; to: string; label: string };

export type RefreshInterval = { seconds: number; label: string };

export const TIME_RANGES: TimeRange[] = [
  { type: "hours", value: 1, label: "Last 1 hour" },
  { type: "hours", value: 6, label: "Last 6 hours" },
  { type: "hours", value: 12, label: "Last 12 hours" },
  { type: "hours", value: 24, label: "Last 24 hours" },
  { type: "hours", value: 48, label: "Last 48 hours" },
  { type: "days", value: 7, label: "Last 7 days" },
  { type: "days", value: 14, label: "Last 14 days" },
  { type: "days", value: 30, label: "Last 30 days" },
];

export const REFRESH_INTERVALS: RefreshInterval[] = [
  { seconds: 0, label: "Manual only" },
  { seconds: 10, label: "10 seconds" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
];

interface DashboardControlsCtx {
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (r: RefreshInterval) => void;
  refreshTick: number; // increments every auto-refresh — pages watch this
  triggerRefresh: () => void; // manual refresh
  toApiParams: () => {
    hours?: number;
    days?: number;
    from?: string;
    to?: string;
  };
}

const Ctx = createContext<DashboardControlsCtx | null>(null);

export function useDashboardControls() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useDashboardControls must be used inside DashboardControlsProvider",
    );
  return ctx;
}

export function DashboardControlsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>(TIME_RANGES[3]); // 24h default
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(
    REFRESH_INTERVALS[1],
  ); // 10s default
  const [refreshTick, setRefreshTick] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  // Auto-refresh ticker
  useEffect(() => {
    clearInterval(timerRef.current);
    if (refreshInterval.seconds > 0) {
      timerRef.current = setInterval(
        () => setRefreshTick((t) => t + 1),
        refreshInterval.seconds * 1000,
      );
    }
    return () => clearInterval(timerRef.current);
  }, [refreshInterval.seconds]);

  const triggerRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const toApiParams = useCallback(() => {
    if (timeRange.type === "hours") return { hours: timeRange.value };
    if (timeRange.type === "days") return { days: timeRange.value };
    if (timeRange.type === "custom")
      return { from: timeRange.from, to: timeRange.to };
    return { hours: 24 };
  }, [timeRange]);

  return (
    <Ctx.Provider
      value={{
        timeRange,
        setTimeRange,
        refreshInterval,
        setRefreshInterval,
        refreshTick,
        triggerRefresh,
        toApiParams,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { label: "OVERVIEW", href: "/dashboard" },
  { label: "USERS", href: "/users" },
  { label: "FAILURES", href: "/failures" },
  { label: "TRACE", href: "/trace" },
  { label: "SCRUBBING", href: "/scrubbing" },
  { label: "TPS", href: "/tps" },
  { label: "MIS", href: "/mis" },
];

const THEME_OPTIONS = [
  { value: "light" as const, icon: "☀️", label: "Light" },
  { value: "dark" as const, icon: "🌙", label: "Dark" },
  { value: "system" as const, icon: "💻", label: "System" },
];

export default function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { mode, resolved, setMode } = useTheme();
  const {
    timeRange,
    setTimeRange,
    refreshInterval,
    setRefreshInterval,
    refreshTick,
    triggerRefresh,
  } = useDashboardControls();

  const [time, setTime] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [showTheme, setShowTheme] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const themeRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown display (counts down to next auto-refresh)
  useEffect(() => {
    if (refreshInterval.seconds === 0) {
      setCountdown(0);
      return;
    }
    setCountdown(refreshInterval.seconds);
    const id = setInterval(
      () => setCountdown((c) => (c <= 1 ? refreshInterval.seconds : c - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [refreshInterval.seconds, refreshTick]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setShowTheme(false);
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) {
        setShowTime(false);
        setShowCustom(false);
      }
      if (refreshRef.current && !refreshRef.current.contains(e.target as Node))
        setShowRefresh(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isDark = resolved === "dark";
  const today = new Date().toLocaleDateString("en-CA");

  const C = {
    navBg: isDark ? "#0d0f14" : "#111318",
    navBorder: isDark ? "#1a1d28" : "#1e2230",
    navText: isDark ? "#c0c4d8" : "#d0d3e0",
    navMuted: isDark ? "#545870" : "#7a7f96",
    navActive: "#1db99f",
    dropBg: isDark ? "#1c1f2a" : "#ffffff",
    dropBorder: isDark ? "#2a2d3e" : "#e5e7eb",
    dropText: isDark ? "#e8eaf2" : "#111318",
    dropMuted: isDark ? "#6b7080" : "#9ca3af",
    dropHover: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    inputBg: isDark ? "#07090e" : "#0a0d15",
    inputBorder: isDark ? "#1a1d28" : "#1e2230",
  };

  const dropStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    position: "absolute",
    top: 44,
    right: 0,
    background: C.dropBg,
    border: `1px solid ${C.dropBorder}`,
    borderRadius: 10,
    padding: 6,
    boxShadow: isDark
      ? "0 8px 24px rgba(0,0,0,0.5)"
      : "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 200,
    minWidth: 200,
    ...extra,
  });

  const dropItemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 10px",
    borderRadius: 7,
    border: "none",
    background: active ? "rgba(26,158,140,0.12)" : "transparent",
    color: active ? "#1a9e8c" : C.dropText,
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: active ? 600 : 400,
    textAlign: "left",
  });

  const btnStyle = (active = false): React.CSSProperties => ({
    background: active ? "rgba(29,185,159,0.12)" : "none",
    border: `1px solid ${active ? "rgba(29,185,159,0.3)" : C.navBorder}`,
    borderRadius: 5,
    cursor: "pointer",
    color: active ? C.navActive : C.navMuted,
    fontSize: 11.5,
    fontWeight: active ? 700 : 500,
    padding: "3px 9px",
    display: "flex",
    alignItems: "center",
    gap: 5,
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    setTimeRange({
      type: "custom",
      from: customFrom,
      to: customTo,
      label: `${customFrom} → ${customTo.slice(5)}`,
    });
    setShowCustom(false);
    setShowTime(false);
    triggerRefresh();
  };

  const countdownColor =
    countdown <= 5 && countdown > 0 && refreshInterval.seconds > 0
      ? "#f59e0b"
      : C.navMuted;

  return (
    <>
      <header
        style={{
          height: 48,
          background: C.navBg,
          borderBottom: `1px solid ${C.navBorder}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          gap: 0,
        }}
      >
        {/* ── Brand ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            paddingRight: 16,
            marginRight: 4,
            borderRight: `1px solid ${C.navBorder}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "#1a9e8c",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            G
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.navText,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            GoFlipo<span style={{ color: C.navMuted, fontWeight: 400 }}>/</span>
            Support
          </span>
        </div>

        {/* ── Nav links ── */}
        <nav
          style={{ display: "flex", alignItems: "stretch", height: 48, gap: 0 }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 13px",
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: "0.06em",
                  color: isActive ? C.navActive : C.navMuted,
                  textDecoration: "none",
                  borderBottom: isActive
                    ? `2px solid ${C.navActive}`
                    : "2px solid transparent",
                  borderTop: "2px solid transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Right controls ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {/* ── Time range picker ── */}
          <div ref={timeRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setShowTime((v) => !v);
                setShowRefresh(false);
                setShowTheme(false);
              }}
              style={btnStyle(true)}
            >
              <span style={{ fontSize: 12 }}>📅</span>
              <span>{timeRange.label}</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
            </button>

            {showTime && (
              <div style={dropStyle({ minWidth: 240 })}>
                <p
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    color: C.dropMuted,
                    padding: "4px 10px 6px",
                  }}
                >
                  TIME RANGE
                </p>

                {TIME_RANGES.map((r) => {
                  const isActive =
                    timeRange.type === r.type &&
                    (r.type === "hours" || r.type === "days") &&
                    timeRange.type === r.type &&
                    (timeRange as any).value === (r as any).value;
                  return (
                    <button
                      key={r.label}
                      onClick={() => {
                        setTimeRange(r);
                        setShowTime(false);
                        setShowCustom(false);
                        triggerRefresh();
                      }}
                      style={dropItemStyle(isActive)}
                    >
                      <span>{r.label}</span>
                      {isActive && (
                        <span style={{ fontSize: 10, color: "#1a9e8c" }}>
                          ●
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: C.dropBorder,
                    margin: "6px 4px",
                  }}
                />

                {/* Custom range toggle */}
                <button
                  onClick={() => setShowCustom((v) => !v)}
                  style={dropItemStyle(timeRange.type === "custom")}
                >
                  <span>Custom range…</span>
                  <span style={{ fontSize: 10 }}>{showCustom ? "▲" : "▶"}</span>
                </button>

                {showCustom && (
                  <div
                    style={{
                      padding: "8px 10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dropMuted,
                          marginBottom: 4,
                        }}
                      >
                        FROM
                      </div>
                      <input
                        type="datetime-local"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        style={{
                          width: "100%",
                          fontSize: 11.5,
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: `1px solid ${C.dropBorder}`,
                          background: C.inputBg,
                          color: C.dropText,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dropMuted,
                          marginBottom: 4,
                        }}
                      >
                        TO
                      </div>
                      <input
                        type="datetime-local"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        style={{
                          width: "100%",
                          fontSize: 11.5,
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: `1px solid ${C.dropBorder}`,
                          background: C.inputBg,
                          color: C.dropText,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                    <button
                      onClick={applyCustomRange}
                      disabled={!customFrom || !customTo}
                      style={{
                        padding: "6px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: "#1a9e8c",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: !customFrom || !customTo ? 0.4 : 1,
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Refresh interval picker ── */}
          <div ref={refreshRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setShowRefresh((v) => !v);
                setShowTime(false);
                setShowTheme(false);
              }}
              style={btnStyle(false)}
              title="Auto-refresh interval"
            >
              <span style={{ fontSize: 12 }}>↻</span>
              {refreshInterval.seconds === 0 ? (
                <span style={{ color: C.navMuted }}>Manual</span>
              ) : (
                <span
                  style={{
                    color: countdownColor,
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                >
                  {countdown}s
                </span>
              )}
              <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
            </button>

            {showRefresh && (
              <div style={dropStyle({ minWidth: 180 })}>
                <p
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    color: C.dropMuted,
                    padding: "4px 10px 6px",
                  }}
                >
                  AUTO-REFRESH
                </p>
                {REFRESH_INTERVALS.map((r) => {
                  const isActive = refreshInterval.seconds === r.seconds;
                  return (
                    <button
                      key={r.label}
                      onClick={() => {
                        setRefreshInterval(r);
                        setShowRefresh(false);
                      }}
                      style={dropItemStyle(isActive)}
                    >
                      <span>{r.label}</span>
                      {isActive && (
                        <span style={{ fontSize: 10, color: "#1a9e8c" }}>
                          ●
                        </span>
                      )}
                    </button>
                  );
                })}
                <div
                  style={{
                    height: 1,
                    background: C.dropBorder,
                    margin: "6px 4px",
                  }}
                />
                <button
                  onClick={() => {
                    triggerRefresh();
                    setShowRefresh(false);
                  }}
                  style={dropItemStyle(false)}
                >
                  <span>↻ Refresh now</span>
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 20,
              background: C.navBorder,
              margin: "0 2px",
            }}
          />

          {/* ── Clock + date ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#1a9e8c",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11.5,
                color: C.navText,
                fontFamily: "monospace",
              }}
            >
              {time}
            </span>
            <span style={{ fontSize: 11, color: C.navMuted }}>·</span>
            <span style={{ fontSize: 11, color: C.navMuted }}>{today}</span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 20,
              background: C.navBorder,
              margin: "0 2px",
            }}
          />

          {/* ── Theme picker ── */}
          <div ref={themeRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                setShowTheme((v) => !v);
                setShowTime(false);
                setShowRefresh(false);
              }}
              title="Theme"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                padding: "4px 6px",
                borderRadius: 5,
                lineHeight: 1,
              }}
            >
              {mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "💻"}
            </button>

            {showTheme && (
              <div style={dropStyle({ minWidth: 148 })}>
                <p
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    color: C.dropMuted,
                    padding: "4px 10px 6px",
                  }}
                >
                  APPEARANCE
                </p>
                {THEME_OPTIONS.map((opt) => {
                  const isSelected = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setMode(opt.value);
                        setShowTheme(false);
                      }}
                      style={dropItemStyle(isSelected)}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <span style={{ fontSize: 15 }}>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#1a9e8c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            color: "#fff",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 20,
              background: C.navBorder,
              margin: "0 2px",
            }}
          />

          {/* ── User + sign out ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {session?.user?.name && (
              <span
                style={{
                  fontSize: 11,
                  color: C.navMuted,
                  maxWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session.user.name}
              </span>
            )}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                background: signingOut ? "rgba(239,68,68,0.06)" : "none",
                border: `1px solid ${signingOut ? "rgba(239,68,68,0.3)" : C.navBorder}`,
                borderRadius: 5,
                cursor: signingOut ? "default" : "pointer",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.07em",
                color: signingOut ? "#ef4444" : C.navMuted,
                padding: "3px 9px",
                whiteSpace: "nowrap",
              }}
            >
              {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
            </button>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div style={{ height: 48 }} />
    </>
  );
}
