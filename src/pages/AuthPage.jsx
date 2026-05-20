// src/pages/AuthPage.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "UTC",
];

// Friendly error messages instead of raw Firebase errors
function friendlyError(msg) {
  if (msg.includes("api-key-not-valid") || msg.includes("api-key"))
    return "❌ Firebase API key is invalid. Please update src/firebase.js with your real Firebase config.";
  if (msg.includes("email-already-in-use"))
    return "This email is already registered. Please sign in instead.";
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found"))
    return "Incorrect email or password. Please try again.";
  if (msg.includes("weak-password"))
    return "Password must be at least 6 characters.";
  if (msg.includes("network-request-failed"))
    return "No internet connection. Please check your network.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Please wait a moment and try again.";
  return msg;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    timezone: "Asia/Manila",
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setSuccessMsg("");
    setForm((f) => ({ ...f, name: "", email: "", password: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate("/dashboard");
      } else {
        // Register as employee only
        await register(form.email, form.password, {
          name: form.name,
          role: "employee",
          timezone: form.timezone,
          schedule: { start: form.scheduleStart, end: form.scheduleEnd },
        });
        setSuccessMsg(`✅ Account created for ${form.name}! You can now sign in.`);
        // Auto-switch to login after successful registration
        setTimeout(() => {
          switchMode("login");
          setForm((f) => ({ ...f, email: form.email, password: "" }));
          setSuccessMsg("");
        }, 2000);
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand-mark">⏱</div>
          <h1 className="brand-name">Mini HCM</h1>
          <p className="brand-sub">Time Tracking Systems</p>
        </div>

       

        {/* Tabs */}
        <div className="tab-row">
          <button
            className={`tab-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Sign In
          </button>
          <button
            className={`tab-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <div className="field-group">
                <label>Full Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Juan dela Cruz"
                  required
                  autoFocus
                />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label>Timezone</label>
                  <select name="timezone" value={form.timezone} onChange={handleChange}>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label>Work Schedule</label>
                <div className="field-row">
                  <input
                    type="time"
                    name="scheduleStart"
                    value={form.scheduleStart}
                    onChange={handleChange}
                    required
                  />
                  <span className="time-sep">to</span>
                  <input
                    type="time"
                    name="scheduleEnd"
                    value={form.scheduleEnd}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="field-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="juan@company.com"
              required
              autoFocus={mode === "login"}
            />
          </div>

          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {mode === "register" && (
            <p className="register-note">
              ℹ️ All new registrations are created as <strong>Employee</strong> accounts.
              The admin account is pre-set.
            </p>
          )}

          {error && <div className="error-box">{error}</div>}
          {successMsg && <div className="success-box">{successMsg}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign In →" : "Create Account")}
          </button>

          <p className="switch-hint">
            {mode === "login"
              ? <>No account yet? <span className="switch-link" onClick={() => switchMode("register")}>Register here</span></>
              : <>Already registered? <span className="switch-link" onClick={() => switchMode("login")}>Sign in here</span></>
            }
          </p>
        </form>
      </div>
    </div>
  );
}
