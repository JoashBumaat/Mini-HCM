// src/pages/AdminPanel.jsx
import { useState, useEffect } from "react";
import {
  collection, query, onSnapshot, getDocs,
  where, doc, updateDoc, Timestamp, getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { formatMinutes, getDateKey } from "../utils/hcmCompute";
import { updateDailySummary } from "../hooks/useAttendance";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function getDateKey7DaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return getDateKey(d);
}

export default function AdminPanel() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("daily");
  const [users, setUsers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()));
  const [dailySummaries, setDailySummaries] = useState([]);
  const [weeklySummaries, setWeeklySummaries] = useState([]);
  const [punches, setPunches] = useState([]);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [userMap, setUserMap] = useState({});

  // Load all users — no orderBy, sort client-side
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setUsers(list);
      const map = {};
      list.forEach((u) => (map[u.id] = u));
      setUserMap(map);
    });
    return unsub;
  }, []);

  // Daily summaries — single where clause only
  useEffect(() => {
    if (tab !== "daily") return;
    const q = query(
      collection(db, "dailySummary"),
      where("date", "==", selectedDate)
    );
    const unsub = onSnapshot(q, (snap) => {
      setDailySummaries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [tab, selectedDate]);

  // Weekly summaries — single where clause, filter + sort client-side
  useEffect(() => {
    if (tab !== "weekly") return;
    const fromKey = getDateKey7DaysAgo();
    const q = query(collection(db, "dailySummary"));
    const unsub = onSnapshot(q, (snap) => {
      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.date >= fromKey)
        .sort((a, b) => b.date.localeCompare(a.date));
      setWeeklySummaries(filtered);
    });
    return unsub;
  }, [tab]);

  // Punches for selected date — single where clause, sort client-side
  useEffect(() => {
    if (tab !== "punches") return;
    const q = query(
      collection(db, "attendance"),
      where("date", "==", selectedDate)
    );
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);
      setPunches(sorted);
    });
    return unsub;
  }, [tab, selectedDate]);

  async function handleEditPunch(punch) {
    setEditingPunch(punch);
    const t = punch.timestamp.toDate();
    setEditTime(
      `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`
    );
  }

  async function savePunchEdit() {
    if (!editingPunch) return;
    const original = editingPunch.timestamp.toDate();
    const [h, m] = editTime.split(":").map(Number);
    const updated = new Date(original);
    updated.setHours(h, m, 0, 0);

    await updateDoc(doc(db, "attendance", editingPunch.id), {
      timestamp: Timestamp.fromDate(updated),
      editedByAdmin: true,
    });

    // Recompute daily summary for affected user/date
    const userSnap = await getDoc(doc(db, "users", editingPunch.userId));
    if (userSnap.exists()) {
      const sched = userSnap.data().schedule;
      await updateDailySummary(editingPunch.userId, editingPunch.date, sched);
    }
    setEditingPunch(null);
  }

  if (userProfile?.role !== "admin") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p>You need admin role to view this page.</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⏱</span>
          <span>Mini HCM - Time Tracking Systems</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-link" href="/dashboard">Dashboard</a>
          <a className="nav-link active" href="/admin">Admin Panel</a>
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{userProfile?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{userProfile?.name}</div>
              <div className="user-role">{userProfile?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={() => logout().then(() => navigate("/"))}>Sign Out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h2 className="page-title">Admin Panel</h2>
            <p className="page-sub">{users.length} employees registered</p>
          </div>
          {(tab === "daily" || tab === "punches") && (
            <div className="date-picker-wrap">
              <label>Date:</label>
              <input
                type="date"
                value={selectedDate}
                max={getDateKey(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="admin-tabs">
          {["daily", "weekly", "punches"].map((t) => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "daily" ? "Daily Report" : t === "weekly" ? "Weekly Report" : "Punch Log"}
            </button>
          ))}
        </div>

        {/* Daily Report */}
        {tab === "daily" && (
          <section className="section">
            <h3 className="section-title">Daily Summary — {selectedDate}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Regular</th>
                    <th>OT</th>
                    <th>Night Diff</th>
                    <th>Late</th>
                    <th>Undertime</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.length === 0 ? (
                    <tr><td colSpan={7} className="empty-row">No records for {selectedDate}</td></tr>
                  ) : (
                    dailySummaries.map((s) => (
                      <tr key={s.id}>
                        <td>{userMap[s.userId]?.name || s.userId}</td>
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
        )}

        {/* Weekly Report */}
        {tab === "weekly" && (
          <section className="section">
            <h3 className="section-title">Weekly Report — Last 7 Days</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
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
                  {weeklySummaries.length === 0 ? (
                    <tr><td colSpan={8} className="empty-row">No records in the last 7 days</td></tr>
                  ) : (
                    weeklySummaries.map((s) => (
                      <tr key={s.id}>
                        <td>{userMap[s.userId]?.name || s.userId}</td>
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
        )}

        {/* Punch Log + Edit */}
        {tab === "punches" && (
          <section className="section">
            <h3 className="section-title">Punch Log — {selectedDate}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Time</th>
                    <th>Edited</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">No punches for {selectedDate}</td></tr>
                  ) : (
                    punches.map((p) => (
                      <tr key={p.id}>
                        <td>{userMap[p.userId]?.name || p.userId}</td>
                        <td>
                          <span className={`badge ${p.type === "in" ? "badge-green" : "badge-red"}`}>
                            {p.type === "in" ? "IN" : "OUT"}
                          </span>
                        </td>
                        <td>{p.timestamp?.toDate().toLocaleTimeString()}</td>
                        <td>{p.editedByAdmin ? <span className="badge badge-orange">Edited</span> : "—"}</td>
                        <td>
                          <button className="edit-btn" onClick={() => handleEditPunch(p)}>Edit</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit Modal */}
            {editingPunch && (
              <div className="modal-overlay" onClick={() => setEditingPunch(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Edit Punch Time</h3>
                  <p>
                    Employee: <strong>{userMap[editingPunch.userId]?.name}</strong>
                    <br />
                    Type: <strong>{editingPunch.type.toUpperCase()}</strong>
                    <br />
                    Date: <strong>{editingPunch.date}</strong>
                  </p>
                  <div className="field-group">
                    <label>New Time</label>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="submit-btn" onClick={savePunchEdit}>Save</button>
                    <button className="cancel-btn" onClick={() => setEditingPunch(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
