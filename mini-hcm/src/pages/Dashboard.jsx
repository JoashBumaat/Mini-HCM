// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAttendance, useWeeklySummary } from "../hooks/useAttendance";
import { formatMinutes, toDecimalHours } from "../utils/hcmCompute";
import { useNavigate } from "react-router-dom";

function KPICard({ label, value, unit = "", color = "var(--accent)" }) {
  return (
    <div className="kpi-card" style={{ "--kpi-color": color }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </span>
    </div>
  );
}

function MetricsRow({ summary }) {
  return (
    <div className="metrics-row">
      <KPICard label="Regular" value={formatMinutes(summary.regularMinutes)} color="var(--green)" />
      <KPICard label="Overtime" value={formatMinutes(summary.otMinutes)} color="var(--blue)" />
      <KPICard label="Night Diff" value={formatMinutes(summary.ndMinutes)} color="var(--purple)" />
      <KPICard label="Late" value={formatMinutes(summary.lateMinutes)} color="var(--orange)" />
      <KPICard label="Undertime" value={formatMinutes(summary.undertimeMinutes)} color="var(--red)" />
    </div>
  );
}

export default function Dashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [punchMsg, setPunchMsg] = useState("");

  const schedule = userProfile?.schedule || { start: "09:00", end: "18:00" };
  const { todayPunches, activePunch, loading, punchIn, punchOut, punchError } = useAttendance(
    userProfile?.id,
    schedule
  );
  const { summaries } = useWeeklySummary(userProfile?.id);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handlePunch() {
    try {
      if (activePunch) {
        await punchOut();
        setPunchMsg("✓ Punched out successfully");
      } else {
        await punchIn();
        setPunchMsg("✓ Punched in successfully");
      }
      setTimeout(() => setPunchMsg(""), 3000);
    } catch (err) {
      setPunchMsg("Error: " + err.message);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const todaySummary = summaries[0] || {};
  const isPunchedIn = !!activePunch;

  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⏱</span>
          <span>MiniHCM</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-link active" href="/dashboard">Dashboard</a>
          {userProfile?.role === "admin" && (
            <a className="nav-link" href="/admin">Admin Panel</a>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{userProfile?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{userProfile?.name}</div>
              <div className="user-role">{userProfile?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h2 className="page-title">My Dashboard</h2>
            <p className="page-sub">Schedule: {schedule.start} – {schedule.end}</p>
          </div>
          <div className="clock-display">
            <div className="clock-time">{timeStr}</div>
            <div className="clock-date">{dateStr}</div>
          </div>
        </header>

        {/* Punch Card */}
        <section className="punch-section">
          <div className={`punch-card ${isPunchedIn ? "punched-in" : ""}`}>
            <div className="punch-status-dot" />
            <div className="punch-status-text">
              {isPunchedIn
                ? `Currently clocked in since ${activePunch?.timestamp?.toDate().toLocaleTimeString()}`
                : "Not clocked in"}
            </div>
            <button
              className={`punch-btn ${isPunchedIn ? "punch-out" : "punch-in"}`}
              onClick={handlePunch}
              disabled={loading}
            >
              {isPunchedIn ? "PUNCH OUT" : "PUNCH IN"}
            </button>
            {punchMsg && <div className="punch-msg">{punchMsg}</div>}
            {punchError && <div className="punch-error">{punchError}</div>}
          </div>
        </section>

        {/* Today's KPIs */}
        <section className="section">
          <h3 className="section-title">Today's Summary</h3>
          <MetricsRow summary={todaySummary} />
        </section>

        {/* Punch Log */}
        <section className="section">
          <h3 className="section-title">Today's Punch Log</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {todayPunches.length === 0 ? (
                  <tr><td colSpan={3} className="empty-row">No punches recorded today</td></tr>
                ) : (
                  todayPunches.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>
                        <span className={`badge ${p.type === "in" ? "badge-green" : "badge-red"}`}>
                          {p.type === "in" ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td>{p.timestamp?.toDate().toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weekly History */}
        <section className="section">
          <h3 className="section-title">Weekly History (Last 7 Days)</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Regular</th>
                  <th>OT</th>
                  <th>Night Diff</th>
                  <th>Late</th>
                  <th>Undertime</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr><td colSpan={7} className="empty-row">No records in the last 7 days</td></tr>
                ) : (
                  summaries.map((s) => (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td className="td-green">{formatMinutes(s.regularMinutes)}</td>
                      <td className="td-blue">{formatMinutes(s.otMinutes)}</td>
                      <td className="td-purple">{formatMinutes(s.ndMinutes)}</td>
                      <td className="td-orange">{s.lateMinutes > 0 ? formatMinutes(s.lateMinutes) : "—"}</td>
                      <td className="td-red">{s.undertimeMinutes > 0 ? formatMinutes(s.undertimeMinutes) : "—"}</td>
                      <td>{formatMinutes(s.totalMinutes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
