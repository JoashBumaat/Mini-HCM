// src/hooks/useAttendance.js
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { computePunchMetrics, aggregateMetrics, getDateKey } from "../utils/hcmCompute";

// ─── Today's Punch Log ────────────────────────────────────────────────────────
// Uses only "userId" + "date" — NO composite index needed, works immediately.
export function useAttendance(userId, schedule) {
  const [todayPunches, setTodayPunches]   = useState([]);
  const [activePunch,  setActivePunch]    = useState(null);
  const [loading,      setLoading]        = useState(true);
  const [punchError,   setPunchError]     = useState("");

  const todayKey = getDateKey(new Date());

  useEffect(() => {
    if (!userId) return;

    // Simple 2-field query: userId == X AND date == "YYYY-MM-DD"
    // Firestore handles this with single-field indexes (auto-created) — no composite index required.
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
      where("date",   "==", todayKey)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        // Sort client-side by timestamp ascending
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

        setTodayPunches(items);

        // Determine if there's an open punch-in (last punch is type "in")
        const last = items[items.length - 1];
        setActivePunch(last?.type === "in" ? last : null);
        setLoading(false);
        setPunchError("");
      },
      (err) => {
        console.error("Attendance listener error:", err);
        setPunchError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [userId, todayKey]);

  // ── Punch In ────────────────────────────────────────────────────────────────
  async function punchIn() {
    setPunchError("");
    const now = new Date();
    try {
      await addDoc(collection(db, "attendance"), {
        userId,
        type:      "in",
        timestamp: Timestamp.fromDate(now),
        date:      getDateKey(now),
      });
    } catch (err) {
      setPunchError("Punch In failed: " + err.message);
      throw err;
    }
  }

  // ── Punch Out ───────────────────────────────────────────────────────────────
  async function punchOut() {
    if (!activePunch) return;
    setPunchError("");
    const now    = new Date();
    const timeIn = activePunch.timestamp.toDate();

    try {
      // 1. Save the OUT record
      await addDoc(collection(db, "attendance"), {
        userId,
        type:        "out",
        timestamp:   Timestamp.fromDate(now),
        date:        getDateKey(now),
        pairedWith:  activePunch.id,
      });

      // 2. Compute metrics for this IN→OUT pair
      const metrics = computePunchMetrics(timeIn, now, schedule);

      // 3. Save the pair record (used to rebuild daily summaries)
      await addDoc(collection(db, "punchPairs"), {
        userId,
        date:    getDateKey(now),
        timeIn:  Timestamp.fromDate(timeIn),
        timeOut: Timestamp.fromDate(now),
        ...metrics,
        createdAt: Timestamp.fromDate(now),
      });

      // 4. Recompute and persist the daily summary
      await updateDailySummary(userId, getDateKey(now), schedule);

    } catch (err) {
      setPunchError("Punch Out failed: " + err.message);
      throw err;
    }
  }

  return { todayPunches, activePunch, loading, punchIn, punchOut, punchError };
}

// ─── Recompute Daily Summary ─────────────────────────────────────────────────
export async function updateDailySummary(userId, dateKey, schedule) {
  const q = query(
    collection(db, "punchPairs"),
    where("userId", "==", userId),
    where("date",   "==", dateKey)
  );
  const snap     = await getDocs(q);
  const allPairs = snap.docs.map((d) => d.data());
  if (allPairs.length === 0) return;

  const agg       = aggregateMetrics(allPairs);
  const summaryId = `${userId}_${dateKey}`;

  await setDoc(doc(db, "dailySummary", summaryId), {
    userId,
    date: dateKey,
    ...agg,
    punchCount: allPairs.length,
    updatedAt:  Timestamp.fromDate(new Date()),
  });
}

// ─── Weekly Summary (last 7 days for one employee) ───────────────────────────
export function useWeeklySummary(userId) {
  const [summaries, setSummaries] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Build last-7-day date keys client-side; filter in JS to avoid composite index
    const q = query(
      collection(db, "dailySummary"),
      where("userId", "==", userId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const fromKey = getDateKey(sevenDaysAgo);

      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.date >= fromKey)
        .sort((a, b) => b.date.localeCompare(a.date)); // newest first

      setSummaries(filtered);
      setLoading(false);
    });

    return unsub;
  }, [userId]);

  return { summaries, loading };
}

// ─── All Employees for a Date (Admin) ────────────────────────────────────────
export function useAllEmployeeSummaries(dateKey) {
  const [summaries, setSummaries] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!dateKey) return;

    const q = query(
      collection(db, "dailySummary"),
      where("date", "==", dateKey)
    );

    const unsub = onSnapshot(q, (snap) => {
      setSummaries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsub;
  }, [dateKey]);

  return { summaries, loading };
}
