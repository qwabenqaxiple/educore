// Ambassador's Prep. School — School Management System
import { useState, useEffect, useCallback } from "react";
import * as API from "./api.js";
import APSLogo from "./APS_logo.jpeg";

// ── Helpers ───────────────────────────────────────────────────────────────────
const gradeOf = s => {
  if (s >= 90) return { g: "A+", l: "Distinction", c: "#10b981" };
  if (s >= 80) return { g: "A", l: "Excellent", c: "#3b82f6" };
  if (s >= 70) return { g: "B", l: "Good", c: "#8b5cf6" };
  if (s >= 60) return { g: "C", l: "Average", c: "#f59e0b" };
  if (s >= 50) return { g: "D", l: "Below Avg", c: "#f97316" };
  return { g: "F", l: "Fail", c: "#ef4444" };
};
const todayStr = () => new Date().toISOString().split("T")[0];
const formatDateForInput = d => {
  if (!d) return "";
  if (typeof d === "string") return d.split("T")[0];
  return d;
};
const downloadCSV = (data, filename, headersMap) => {
  if (!data || !data.length) return;
  const headers = Object.keys(headersMap);
  const csvRows = [];
  // Header row
  csvRows.push(Object.values(headersMap).map(h => `"${h.replace(/"/g, '""')}"`).join(","));
  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) val = "";
      else if (header === "date_of_birth" || header === "created_at") val = formatDateForInput(val);
      else val = String(val);
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
const formatUserAgent = (ua) => {
  if (!ua) return "Unknown Device";
  if (ua.includes("PostmanRuntime")) return "Postman API Client";
  
  let os = "Device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("Android")) os = "Android";
  
  let browser = "";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/")) browser = "Safari";
  
  return browser ? `${os} (${browser})` : os;
};
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const PT = ["07:30–08:30", "08:30–09:30", "09:30–10:30", "10:30–11:30", "11:30–12:30", "12:30–13:30"];
const SC = { Present: "#10b981", Absent: "#ef4444", Late: "#f59e0b" };
const RC = { Admin: "#f59e0b", Teacher: "#3b82f6", Student: "#10b981", Parent: "#a78bfa" };
const getRoleColor = (role, isLight) => {
  const light = { Admin: "#b45309", Teacher: "#1d4ed8", Student: "#15803d", Parent: "#6b21a8" };
  const dark = { Admin: "#f59e0b", Teacher: "#3b82f6", Student: "#10b981", Parent: "#a78bfa" };
  return isLight ? light[role] : dark[role];
};
const getGradeColor = (c, isLight) => {
  if (!isLight) return c;
  if (c === "#10b981") return "#15803d";
  if (c === "#3b82f6") return "#1d4ed8";
  if (c === "#8b5cf6") return "#6b21a8";
  if (c === "#f59e0b") return "#b45309";
  if (c === "#f97316") return "#c2410c";
  if (c === "#ef4444") return "#b91c1c";
  return c;
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root {
  --bg-main: #080c12;
  --bg-card: #0d1117;
  --border-main: #1a2438;
  --text-main: #94a3b8;
  --text-title: #f1f5f9;
  --text-label: #475569;
  --bg-input: #040608;
  --bg-hover: #070b10;
  --bg-table-header: #0a0f1a;
  --border-table: #0d1827;
  --bg-modal: #0a0f1a;
  
  --text-link: #60a5fa;
  --bg-link: #0d1827;
  --text-danger: #fca5a5;
  --bg-danger: #1a0a0a;
}
.theme-light {
  --bg-main: #f8fafc;
  --bg-card: #ffffff;
  --border-main: #cbd5e1;
  --text-main: #334155;
  --text-title: #0f172a;
  --text-label: #64748b;
  --bg-input: #ffffff;
  --bg-hover: #f1f5f9;
  --bg-table-header: #f8fafc;
  --border-table: #e2e8f0;
  --bg-modal: #ffffff;
  
  --text-link: #1d4ed8;
  --bg-link: #eff6ff;
  --text-danger: #dc2626;
  --bg-danger: #fee2e2;
}
body{font-family:'Outfit',sans-serif;background:var(--bg-main);color:var(--text-main);transition:background .2s,color .2s}
.app-container{display:flex;height:100vh;width:100vw;overflow:hidden;background:var(--bg-main);color:var(--text-main);transition:background .2s,color .2s}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg-card)}
::-webkit-scrollbar-thumb{background:var(--border-main);border-radius:3px}
input,select,textarea{outline:none;font-family:inherit}
button{cursor:pointer;font-family:inherit}
.nb{background:none;border:none;width:100%;text-align:left;padding:11px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:500;color:#64748b;transition:all .18s}
.nb:hover{background:#0d1827;color:#f1f5f9}
.nb.on{background:linear-gradient(135deg,#1a3a6b,#1d4ed8);color:#fff;box-shadow:0 4px 18px #1d4ed840}
.card{background:var(--bg-card);border:1px solid var(--border-main);border-radius:18px;padding:22px;transition:background .2s,border-color .2s}
.bp{background:linear-gradient(135deg,#1a3a6b,#1d4ed8);color:#fff;border:none;padding:10px 20px;border-radius:9px;font-weight:600;font-size:13px;transition:opacity .15s}
.bp:hover{opacity:.85}
.bp:disabled{opacity:.4;cursor:not-allowed}
.be{background:var(--bg-link);color:var(--text-link);border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:600;transition:background .2s,color .2s}
.be:hover{opacity:0.85}
.bd{background:var(--bg-danger);color:var(--text-danger);border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:600;transition:background .2s,color .2s}
.bd:hover{opacity:0.85}
.inp{background:var(--bg-input);border:1px solid var(--border-main);color:var(--text-main);padding:10px 13px;border-radius:9px;font-size:14px;width:100%;transition:all .2s;font-family:inherit}
.inp:focus{border-color:#1d4ed8}
.lbl{font-size:11px;font-weight:700;color:var(--text-label);margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:.7px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:var(--bg-table-header);color:var(--text-label);padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border-main)}
.tbl td{padding:13px 14px;border-bottom:1px solid var(--border-table);color:var(--text-main);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:var(--bg-hover)}
.mbg{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px)}
.modal{background:var(--bg-modal);border:1px solid var(--border-main);border-radius:22px;padding:30px;width:min(580px,96vw);max-height:88vh;overflow-y:auto}
.av{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.badge-blue{background:var(--bg-link);color:var(--text-link);transition:background .2s,color .2s}
.badge-green{background:#052e16;color:#86efac;transition:background .2s,color .2s}
.theme-light .badge-green{background:#dcfce7;color:#15803d}
.badge-purple{background:#1e1b4b;color:#a5b4fc;transition:background .2s,color .2s}
.theme-light .badge-purple{background:#f3e8ff;color:#6b21a8}
.badge-danger{background:var(--bg-danger);color:var(--text-danger);transition:background .2s,color .2s}
.badge-female{background:#db277722;color:#f472b6;transition:background .2s,color .2s}
.badge-male{background:#3b82f622;color:#60a5fa;transition:background .2s,color .2s}
.theme-light .badge-female{background:#fce7f3;color:#db2777}
.theme-light .badge-male{background:#dbeafe;color:#2563eb}
.tab{padding:8px 18px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.tab.on{background:#1d4ed8;color:#fff}
.tab:not(.on){background:var(--bg-card);color:var(--text-label)}
.tab:not(.on):hover{color:var(--text-main)}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:up .24s ease}
.toast{position:fixed;bottom:26px;right:26px;padding:13px 20px;border-radius:12px;font-weight:600;font-size:14px;z-index:999;box-shadow:0 8px 28px #0008;animation:up .2s ease}
.spin{display:inline-block;width:16px;height:16px;border:2px solid #1d4ed880;border-top-color:#1d4ed8;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--text-label);font-size:14px}
.notif-dropdown {
  position: absolute;
  top: 48px;
  right: 0;
  width: 380px;
  background: var(--bg-modal);
  border: 1px solid var(--border-main);
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: up .2s ease;
}
.notif-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-main);
  padding-bottom: 12px;
  margin-bottom: 8px;
}
.notif-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-title);
}
.notif-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}
.notif-item {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border-table);
  background: var(--bg-input);
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
  text-align: left;
}
.notif-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-main);
}
.notif-item.unread {
  border-left: 4px solid #1d4ed8;
  background: var(--bg-hover);
}
.notif-item.type-info {
  border-left-color: #3b82f6;
}
.notif-item.type-warning {
  border-left-color: #f59e0b;
}
.notif-item.type-success {
  border-left-color: #10b981;
}
.notif-sender {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-label);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.notif-subject {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-title);
}
.notif-body {
  font-size: 12px;
  color: var(--text-main);
  line-height: 1.4;
  white-space: pre-wrap;
}
.notif-time {
  font-size: 10px;
  color: var(--text-label);
  align-self: flex-end;
}
.notif-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-label);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.notif-close-btn {
  background: none;
  border: none;
  color: var(--text-label);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.notif-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}
.notif-footer {
  border-top: 1px solid var(--border-main);
  padding-top: 12px;
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.btn-link {
  background: none;
  border: none;
  color: var(--text-link);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all .15s;
}
.btn-link:hover {
  background: var(--bg-hover);
  text-decoration: none;
}
`;

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Spinner = () => <span className="spin" />;
const Loading = () => (
  <div className="loading"><Spinner /> Loading…</div>
);

const PH = ({ title, sub, btn }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 }}>
    <div>
      <div style={{ fontWeight: 800, fontSize: 22, color: "var(--text-title)", letterSpacing: -.4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-label)", marginTop: 3 }}>{sub}</div>
    </div>
    {btn}
  </div>
);

const Fld = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}><label className="lbl">{label}</label>{children}</div>
);

function Modal({ title, onClose, children }) {
  return (
    <div className="mbg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal anim">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-title)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-label)", width: 30, height: 30, borderRadius: 7, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const SaveCancel = ({ onSave, onCancel, label = "Save", saving }) => (
  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
    <button onClick={onCancel} style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-main)", padding: "9px 18px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
    <button className="bp" onClick={onSave} disabled={saving}>
      {saving ? <><Spinner /> Saving…</> : label}
    </button>
  </div>
);

// Hook: load data + notify on error
function useData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchFn()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, deps); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ── Compose Announcement Modal Component ──────────────────────────────────────
function ComposeAnnouncementForm({ onClose, onSuccess, notify, user }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [target, setTarget] = useState("all");
  const [specificUser, setSpecificUser] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target === "specific") {
      setLoadingUsers(true);
      API.users.list()
        .then(res => setUsersList(res || []))
        .catch(err => {
          console.error(err);
          notify("Failed to load user list", false);
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [target, notify]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      notify("Please enter both a title and a message", false);
      return;
    }
    const targetVal = target === "specific" ? specificUser : target;
    if (target === "specific" && !specificUser) {
      notify("Please select a specific recipient user", false);
      return;
    }

    setSending(true);
    try {
      await API.notifications.send({
        title: title.trim(),
        message: message.trim(),
        type,
        target: targetVal
      });
      onSuccess();
    } catch (err) {
      notify(err.message || "Failed to dispatch notification", false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Fld label="Target Audience">
        <select className="inp" value={target} onChange={e => setTarget(e.target.value)}>
          <option value="all">All Users</option>
          <option value="teachers">Teachers Only</option>
          <option value="students">Students Only</option>
          <option value="parents">Parents Only</option>
          <option value="specific">Specific User...</option>
        </select>
      </Fld>

      {target === "specific" && (
        <Fld label="Select User">
          {loadingUsers ? <Spinner /> : (
            <select className="inp" value={specificUser} onChange={e => setSpecificUser(e.target.value)}>
              <option value="">-- Choose User --</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role} - {u.email})
                </option>
              ))}
            </select>
          )}
        </Fld>
      )}

      <Fld label="Notification Type">
        <div style={{ display: "flex", gap: 12 }}>
          {["info", "warning", "success"].map(t => {
            const colors = {
              info: { bg: "#3b82f622", text: "#60a5fa", border: "#3b82f688" },
              warning: { bg: "#f59e0b22", text: "#fbbf24", border: "#f59e0b88" },
              success: { bg: "#10b98122", text: "#34d399", border: "#10b98188" }
            };
            const isSelected = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `2px solid ${isSelected ? colors[t].text : "var(--border-main)"}`,
                  background: isSelected ? colors[t].bg : "var(--bg-input)",
                  color: isSelected ? colors[t].text : "var(--text-label)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                {t === "info" && "ℹ️ Info"}
                {t === "warning" && "⚠️ Warning"}
                {t === "success" && "✅ Success"}
              </button>
            );
          })}
        </div>
      </Fld>

      <Fld label="Announcement Title">
        <input 
          className="inp" 
          placeholder="e.g. Term 1 Report Cards Released" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
        />
      </Fld>

      <Fld label="Message Detail">
        <textarea 
          className="inp" 
          placeholder="Write your announcement details here..." 
          rows={5} 
          style={{ resize: "vertical" }}
          value={message} 
          onChange={e => setMessage(e.target.value)} 
        />
      </Fld>

      <SaveCancel onSave={handleSend} onCancel={onClose} label="Dispatch Announcement 🚀" saving={sending} />
    </div>
  );
}

// ── Sent Announcement History Component ───────────────────────────────────────
function SentHistoryList({ sentNotifs, loadingSent, onReload }) {
  useEffect(() => {
    onReload();
  }, []); // eslint-disable-line

  if (loadingSent) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="be" onClick={onReload} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          🔄 Refresh Logs
        </button>
      </div>

      <div style={{ maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {sentNotifs.length === 0 ? (
          <div className="notif-empty">
            <span style={{ fontSize: 32 }}>📜</span>
            <div style={{ fontWeight: 600 }}>No Dispatched Announcements</div>
            <div style={{ fontSize: 12 }}>You have not sent any notifications yet.</div>
          </div>
        ) : (
          sentNotifs.map(n => {
            const badgeColors = {
              success: "badge-green",
              warning: "badge-danger",
              info: "badge-blue"
            };
            return (
              <div 
                key={n.id} 
                className={`card anim`} 
                style={{ 
                  padding: 14, 
                  background: "var(--bg-input)", 
                  borderColor: "var(--border-table)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${badgeColors[n.type] || "badge-blue"}`} style={{ textTransform: "uppercase", fontSize: 9 }}>
                      {n.type || "info"}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-label)", fontWeight: 700 }}>
                      TO: <span style={{ color: "var(--text-title)" }}>{n.recipient_name || "Unknown User"}</span> ({n.recipient_role || "User"})
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-label)" }}>
                    {new Date(n.created_at).toLocaleString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-title)" }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-main)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{n.message}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [pg, setPg] = useState(() => localStorage.getItem("educore_pg") || "dash");
  const [toast, setToast] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLight, setIsLight] = useState(() => localStorage.getItem("educore_theme") === "light");
  const [networkError, setNetworkError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const changePg = (p) => {
    setPg(p);
    localStorage.setItem("educore_pg", p);
  };

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    localStorage.setItem("educore_theme", next ? "light" : "dark");
  };

  // Re-hydrate session on page load
  const hydrate = useCallback(async () => {
    const token = API.getToken();
    if (!token) {
      setCheckingAuth(false);
      return;
    }
    setRetrying(true);
    try {
      const r = await API.auth.me();
      setUser(r.user);
      setNetworkError(false);
    } catch (err) {
      console.error("Hydration error:", err);
      if (err.status === 401 || err.message?.toLowerCase().includes("unauthorized")) {
        API.clearToken();
        setUser(null);
      } else {
        // Network timeout, server restart, etc. Preserve token and show offline card
        setNetworkError(true);
      }
    } finally {
      setCheckingAuth(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const [notifs, setNotifs] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showSentModal, setShowSentModal] = useState(false);
  const [sentNotifs, setSentNotifs] = useState([]);
  const [loadingSent, setLoadingSent] = useState(false);

  const loadNotifs = useCallback(async () => {
    if (!API.getToken()) return;
    try {
      const res = await API.notifications.list();
      setNotifs(res || []);
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, []);

  const loadSentNotifs = useCallback(async () => {
    if (!API.getToken()) return;
    setLoadingSent(true);
    try {
      const res = await API.notifications.listSent();
      setSentNotifs(res || []);
    } catch (e) {
      console.error("Error loading sent notifications:", e);
    } finally {
      setLoadingSent(false);
    }
  }, []);

  useEffect(() => {
    const token = API.getToken();
    if (token && user) {
      loadNotifs();
      const interval = setInterval(loadNotifs, 15000);
      return () => clearInterval(interval);
    }
  }, [user, loadNotifs]);

  useEffect(() => {
    if (!showNotifDropdown) return;
    const close = () => setShowNotifDropdown(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [showNotifDropdown]);

  const markAsRead = async (id) => {
    try {
      await API.notifications.read(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      notify("Failed to mark as read", false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await API.notifications.readAll();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      notify("All notifications marked as read");
    } catch (e) {
      notify("Failed to mark all as read", false);
    }
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    try {
      await API.notifications.delete(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
      notify("Notification deleted");
    } catch (e) {
      notify("Failed to delete notification", false);
    }
  };

  const handleLogin = ({ token, user }) => {
    API.setToken(token);
    setUser(user);
    changePg("dash");
  };

  const handleLogout = () => {
    API.clearToken();
    setUser(null);
    localStorage.removeItem("educore_pg");
    setPg("dash");
  };

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", background: "#040608", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
        <div className="loading" style={{ flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 32 }}>🎓</div>
          <div style={{ color: "#475569" }}>Loading Ambassador's Prep. School…</div>
        </div>
      </div>
    );
  }

  if (networkError) {
    return (
      <div style={{ minHeight: "100vh", background: "#040608", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0", fontFamily: "'Outfit',sans-serif", padding: 20 }}>
        <style>{CSS}</style>
        <div className="card anim" style={{ width: "min(420px, 96vw)", textAlign: "center", border: "1px solid var(--border-main)", padding: 40, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📡</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-title)", marginBottom: 12 }}>Connection Lost</div>
          <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: "1.6", marginBottom: 26 }}>
            We're having trouble reaching the school server. Please verify your connection or check back shortly.
          </p>
          <button className="bp" style={{ width: "100%", padding: 12, fontSize: 14 }} onClick={hydrate} disabled={retrying}>
            {retrying ? <><Spinner /> Reconnecting…</> : "Try Reconnecting"}
          </button>
        </div>
      </div>
    );
  }

  if (!user) return <><style>{CSS}</style><Login onLogin={handleLogin} /></>;

  const PAGES = [
    { id: "dash", icon: "⊞", label: "Dashboard", roles: ["Admin", "Teacher", "Student", "Parent"] },
    { id: "stud", icon: "👤", label: "Students", roles: ["Admin", "Teacher"] },
    { id: "tchr", icon: "🎓", label: "Teachers", roles: ["Admin"] },
    { id: "cls", icon: "🏫", label: "Classes & Subjects", roles: ["Admin", "Teacher"] },
    { id: "att", icon: "📋", label: "Attendance", roles: ["Admin", "Teacher", "Student"] },
    { id: "exam", icon: "📝", label: "Exams & Results", roles: ["Admin", "Teacher", "Student", "Parent"] },
    { id: "fee", icon: "💳", label: "Fee Management", roles: ["Admin", "Parent"] },
    { id: "tt", icon: "🗓", label: "Timetable", roles: ["Admin", "Teacher", "Student"] },
    { id: "rpt", icon: "📊", label: "Reports", roles: ["Admin", "Teacher"] },
    { id: "usr", icon: "🔐", label: "Users", roles: ["Admin"] },
  ].filter(p => p.roles.includes(user.role));

  const unreadCount = notifs.filter(n => !n.read).length;
  const activePage = PAGES.find(p => p.id === pg);
  const pageTitle = activePage ? activePage.label : "Dashboard";

  return (
    <div className={`app-container ${isLight ? "theme-light" : ""}`}>
      <style>{CSS}</style>

      {/* Sidebar */}
      <aside style={{ width: 218, background: "#060910", borderRight: "1px solid #0d1827", display: "flex", flexDirection: "column", padding: "18px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 22px" }}>
          <img src={APSLogo} alt="APS Logo" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 13, color: "#f1f5f9", letterSpacing: -.3 }}>Ambassador's Prep.</div>
            <div style={{ fontSize: 9.5, color: "#475569", fontWeight: 700, letterSpacing: 1 }}>SCHOOL MANAGEMENT</div>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {PAGES.map(p => (
            <button key={p.id} className={`nb${pg === p.id ? " on" : ""}`} onClick={() => changePg(p.id)}>
              <span style={{ fontSize: 15 }}>{p.icon}</span><span>{p.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #0d1827", paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 10px" }}>
            <div className="av" style={{ background: RC[user.role] + "22", color: RC[user.role] }}>{user.avatar}</div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name.split(" ")[0]}</div>
              <span style={{ fontSize: 10, background: RC[user.role] + "22", color: RC[user.role], padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{user.role}</span>
            </div>
          </div>
          <button className="nb" onClick={handleLogout} style={{ color: "#ef4444" }}>↩ Sign Out</button>
        </div>
      </aside>

      {/* Right Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        
        {/* Global Premium Top Navbar */}
        <header style={{ 
          height: "64px", 
          borderBottom: "1px solid var(--border-main)", 
          background: "var(--bg-card)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          padding: "0 32px", 
          flexShrink: 0,
          position: "relative",
          zIndex: 150,
          transition: "background .2s, border-color .2s"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, color: "var(--text-label)" }}>{activePage?.icon || "🎓"}</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-title)", letterSpacing: "-0.2px" }}>
              {pageTitle}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Universal Theme Toggle */}
            <button 
              onClick={toggleTheme} 
              style={{ 
                background: "var(--bg-hover)", 
                border: "1px solid var(--border-main)", 
                borderRadius: "10px", 
                width: "38px", 
                height: "38px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "var(--text-main)", 
                cursor: "pointer",
                transition: "all .15s"
              }}
              title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              <span style={{ fontSize: 15 }}>{isLight ? "🌙" : "☀️"}</span>
            </button>

            {/* Premium Notification Bell */}
            <div style={{ position: "relative" }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifDropdown(!showNotifDropdown);
                }} 
                style={{ 
                  background: "var(--bg-hover)", 
                  border: "1px solid var(--border-main)", 
                  borderRadius: "10px", 
                  width: "38px", 
                  height: "38px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "var(--text-main)", 
                  cursor: "pointer",
                  position: "relative",
                  transition: "all .15s"
                }}
                title="Notifications"
              >
                <span style={{ fontSize: 16 }}>🔔</span>
                {unreadCount > 0 && (
                  <span style={{ 
                    position: "absolute", 
                    top: "-4px", 
                    right: "-4px", 
                    background: "#ef4444", 
                    color: "#fff", 
                    fontSize: "9px", 
                    fontWeight: 800, 
                    borderRadius: "50%", 
                    minWidth: "16px", 
                    height: "16px", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    padding: "0 4px", 
                    border: "2px solid var(--bg-card)" 
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="btn-link" onClick={() => { markAllAsRead(); setShowNotifDropdown(false); }}>
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="notif-list">
                    {notifs.length === 0 ? (
                      <div className="notif-empty">
                        <span style={{ fontSize: 24 }}>🔔</span>
                        <div style={{ fontWeight: 600 }}>All caught up!</div>
                        <div style={{ fontSize: 11 }}>No recent announcements.</div>
                      </div>
                    ) : (
                      notifs.map(n => {
                        const iconMap = {
                          success: "✅",
                          warning: "⚠️",
                          info: "ℹ️"
                        };
                        return (
                          <div 
                            key={n.id} 
                            className={`notif-item ${!n.read ? "unread" : ""} type-${n.type}`}
                            onClick={() => {
                              if (!n.read) markAsRead(n.id);
                              setShowNotifDropdown(false);
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                              <span className="notif-sender">
                                {iconMap[n.type] || "ℹ️"} {n.sender_name || "System"} • {n.sender_role || "Admin"}
                              </span>
                              <button 
                                className="notif-close-btn" 
                                onClick={(e) => deleteNotif(n.id, e)}
                                title="Dismiss notification"
                              >
                                ×
                              </button>
                            </div>
                            <div className="notif-subject">{n.title}</div>
                            <div className="notif-body">{n.message}</div>
                            <span className="notif-time">
                              {new Date(n.created_at).toLocaleString("en-GH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {(user.role === "Admin" || user.role === "Teacher") && (
                    <div className="notif-footer">
                      <button 
                        className="btn-link" 
                        style={{ color: "var(--text-main)" }}
                        onClick={() => {
                          setShowSentModal(true);
                          setShowNotifDropdown(false);
                        }}
                      >
                        📜 Sent History
                      </button>
                      <button 
                        className="be" 
                        onClick={() => {
                          setShowComposeModal(true);
                          setShowNotifDropdown(false);
                        }}
                      >
                        + Compose
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main style={{ flex: 1, overflow: "auto", padding: "28px 32px", background: "var(--bg-main)" }}>
          {pg === "dash" && <Dash user={user} go={changePg} N={notify} isLight={isLight} setIsLight={toggleTheme} />}
          {pg === "stud" && <Studs user={user} N={notify} isLight={isLight} />}
          {pg === "tchr" && <Tchrs user={user} N={notify} isLight={isLight} />}
          {pg === "cls" && <Cls user={user} N={notify} isLight={isLight} />}
          {pg === "att" && <Att user={user} N={notify} isLight={isLight} />}
          {pg === "exam" && <Exam user={user} N={notify} isLight={isLight} />}
          {pg === "fee" && <Fees user={user} N={notify} isLight={isLight} />}
          {pg === "tt" && <TT user={user} N={notify} isLight={isLight} />}
          {pg === "rpt" && <Rpt user={user} N={notify} isLight={isLight} />}
          {pg === "usr" && <Usrs user={user} N={notify} isLight={isLight} />}
        </main>
      </div>

      {showComposeModal && (
        <Modal title="Compose Announcement" onClose={() => setShowComposeModal(false)}>
          <ComposeAnnouncementForm 
            onClose={() => setShowComposeModal(false)}
            onSuccess={() => {
              setShowComposeModal(false);
              loadNotifs();
              notify("Announcement dispatched successfully!");
            }}
            notify={notify}
            user={user}
          />
        </Modal>
      )}

      {showSentModal && (
        <Modal title="Sent Announcement History" onClose={() => setShowSentModal(false)}>
          <SentHistoryList 
            sentNotifs={sentNotifs}
            loadingSent={loadingSent}
            onReload={loadSentNotifs}
          />
        </Modal>
      )}

      {toast && (
        <div className="toast" style={{ background: toast.ok ? "#052e16" : "#450a0a", color: toast.ok ? "#86efac" : "#fca5a5", border: `1px solid ${toast.ok ? "#166534" : "#991b1b"}` }}>
          {toast.ok ? "✓ " : "✗ "}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);
  const [token, setToken] = useState("");
  const [view, setView] = useState("login");
  const [msg, setMsg] = useState("");
  const [appEnv, setAppEnv] = useState("development");

  useEffect(() => {
    API.auth.config()
      .then(res => {
        if (res && res.appEnv) setAppEnv(res.appEnv);
      })
      .catch(err => console.error("Failed to load environment configuration:", err));

    const params = new URLSearchParams(window.location.search);
    const t = params.get("resetToken");
    if (t) {
      setToken(t);
      setView("reset");
    }
  }, []);

  const DEMOS = [
    { r: "Admin", e: "admin@educore.edu", p: "admin123" },
    { r: "Teacher", e: "teacher@educore.edu", p: "teach123" },
    { r: "Student", e: "student@educore.edu", p: "stud123" },
    { r: "Parent", e: "parent@educore.edu", p: "par123" },
  ];
  const go = async () => {
    setErr(""); setLoading(true);
    try {
      const data = await API.auth.login(em, pw);
      onLogin(data);
    } catch (e) {
      setErr(e.message || "Invalid credentials");
    } finally { setLoading(false); }
  };
  const reset = async () => {
    setErr(""); setMsg(""); setLoading(true);
    try {
      await API.auth.forgotPassword(em);
      setMsg("If an account exists for this email, a reset link has been sent.");
    } catch (e) {
      setErr(e.message || "Failed to request password reset");
    } finally { setLoading(false); }
  };
  const doReset = async () => {
    if (!newPw) return setErr("Please enter a new password");
    if (newPw.length < 6) return setErr("Password must be at least 6 characters");
    if (newPw !== confirmPw) return setErr("Passwords do not match");

    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await API.auth.resetPassword(token, newPw);
      setMsg(res.message || "Password updated successfully!");
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        setView("login");
        setMsg("");
        setNewPw("");
        setConfirmPw("");
      }, 3000);
    } catch (e) {
      setErr(e.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(rgba(4,6,8,0.82), rgba(4,6,8,0.82)), url(${APSLogo}) center/cover no-repeat fixed`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit',sans-serif", color: "#e2e8f0" }}>
      <style>{CSS}</style>
      <div style={{ width: "min(420px,96vw)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 90, height: 90, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "3px solid #1d4ed8", boxShadow: "0 0 24px #1d4ed855" }}>
            <img src={APSLogo} alt="APS Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", letterSpacing: -.5 }}>Ambassador's Prep. School</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4, fontWeight: 600, letterSpacing: .5 }}>SCHOOL MANAGEMENT SYSTEM</div>
        </div>
        <div style={{ background: "#0a0f1a", border: "1px solid #1a2438", borderRadius: 22, padding: 34 }}>
          {view === "login" ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 22 }}>Welcome back</div>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl">Email</label>
                <input className="inp" value={em} onChange={e => setEm(e.target.value)} placeholder="you@school.edu" type="email" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label className="lbl" style={{ marginBottom: 0 }}>Password</label>
                  <button onClick={() => { setView("forgot"); setErr(""); setMsg(""); }} style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Forgot Password?</button>
                </div>
                <input className="inp" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e => e.key === "Enter" && go()} />
              </div>
              {err && <div style={{ background: "#450a0a", border: "1px solid #991b1b", color: "#fca5a5", padding: "9px 13px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
              <button className="bp" style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={go} disabled={loading}>
                {loading ? <><Spinner /> Signing in…</> : "Sign In →"}
              </button>
              {appEnv !== "production" && (
                <div style={{ textAlign: "center", marginTop: 18 }}>
                  <button onClick={() => setDemo(d => !d)} style={{ background: "none", border: "none", color: "#475569", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{demo ? "Hide" : "Show"} demo accounts</button>
                </div>
              )}
              {appEnv !== "production" && demo && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  {DEMOS.map(d => (
                    <button key={d.r} onClick={() => { setEm(d.e); setPw(d.p); }}
                      style={{ background: "#040608", border: `1px solid ${RC[d.r]}44`, borderRadius: 9, padding: "9px 8px", color: RC[d.r], fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {d.r} Demo
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : view === "forgot" ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Reset Password</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 22 }}>Enter your email address and we'll send you a link to reset your password.</div>
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Email</label>
                <input className="inp" value={em} onChange={e => setEm(e.target.value)} placeholder="you@school.edu" type="email" onKeyDown={e => e.key === "Enter" && reset()} />
              </div>
              {err && <div style={{ background: "#450a0a", border: "1px solid #991b1b", color: "#fca5a5", padding: "9px 13px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
              {msg && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#86efac", padding: "9px 13px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>✓ {msg}</div>}
              <button className="bp" style={{ width: "100%", padding: 13, fontSize: 15, marginBottom: 18 }} onClick={reset} disabled={loading}>
                {loading ? <><Spinner /> Sending…</> : "Send Reset Link"}
              </button>
              <div style={{ textAlign: "center" }}>
                <button onClick={() => { setView("login"); setErr(""); setMsg(""); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>←</span> Back to Login
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Set New Password</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 22 }}>Enter and confirm your new password below.</div>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl">New Password</label>
                <input className="inp" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" type="password" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Confirm Password</label>
                <input className="inp" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e => e.key === "Enter" && doReset()} />
              </div>
              {err && <div style={{ background: "#450a0a", border: "1px solid #991b1b", color: "#fca5a5", padding: "9px 13px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
              {msg && <div style={{ background: "#052e16", border: "1px solid #166534", color: "#86efac", padding: "9px 13px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>✓ {msg}</div>}
              <button className="bp" style={{ width: "100%", padding: 13, fontSize: 15, marginBottom: 18 }} onClick={doReset} disabled={loading}>
                {loading ? <><Spinner /> Resetting…</> : "Update Password"}
              </button>
              <div style={{ textAlign: "center" }}>
                <button onClick={() => { setView("login"); setErr(""); setMsg(""); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>←</span> Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dash({ user, go, N, isLight, setIsLight }) {
  const { data, loading } = useData(() => API.reports.dashboard());
  const { data: students } = useData(() => API.students.list({ limit: 4 }));

  if (loading) return <Loading />;
  const d = data || {};
  const att = d.attendance || {};
  const fees = d.fees || {};
  const totFee = parseFloat(fees.total_billed || 0);
  const colFee = parseFloat(fees.total_collected || 0);

  const STATS = [
    { label: "Students", val: d.students || 0, icon: "👤", c: "#3b82f6", page: "stud" },
    { label: "Teachers", val: d.teachers || 0, icon: "🎓", c: "#10b981", page: "tchr" },
    { label: "Classes", val: d.classes || 0, icon: "🏫", c: "#f59e0b", page: "cls" },
    { label: "Subjects", val: d.subjects || 0, icon: "📚", c: "#a78bfa", page: "cls" },
    { label: "Exams", val: d.exams || 0, icon: "📝", c: "#ec4899", page: "exam" },
    { label: "Collected", val: `₵${((colFee) / 1000).toFixed(1)}k`, icon: "💳", c: "#10b981", page: "fee" },
    { label: "Outstanding", val: `₵${(parseFloat(fees.total_outstanding || 0) / 1000).toFixed(1)}k`, icon: "⚠️", c: "#f59e0b", page: "fee" },
    { label: "Attendance", val: att.total || 0, icon: "📋", c: "#60a5fa", page: "att" },
  ];

  const attSum = [
    { l: "Present", n: att.present || 0, c: "#10b981" },
    { l: "Absent", n: att.absent || 0, c: "#ef4444" },
    { l: "Late", n: att.late || 0, c: "#f59e0b" },
  ];
  const attTotal = att.total || 1;

  return (
    <div className="anim">
      <PH title={`Hello, ${user.name.split(" ")[0]} 👋`} sub={new Date().toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(185px,1fr))", gap: 14, marginBottom: 26 }}>
        {STATS.map(s => (
          <button key={s.label} onClick={() => go(s.page)}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-main)", borderRadius: 16, padding: "18px 20px", textAlign: "left", cursor: "pointer", transition: "all .18s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = s.c; e.currentTarget.style.transform = "translateY(-2px)" }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border-main)"; e.currentTarget.style.transform = "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.c + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{s.icon}</div>
              <span style={{ fontSize: 10, color: s.c, fontWeight: 700, background: s.c + "18", padding: "3px 8px", borderRadius: 9, alignSelf: "flex-start" }}>↗</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 26, color: "var(--text-title)", letterSpacing: -.5 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "var(--text-label)", marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-title)", marginBottom: 16 }}>📋 Overall Attendance</div>
          {attSum.map(a => (
            <div key={a.l} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: a.c, fontWeight: 600 }}>{a.l}</span>
                <span style={{ color: "var(--text-label)" }}>{a.n}/{att.total || 0}</span>
              </div>
              <div style={{ height: 7, background: "var(--bg-input)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(a.n / attTotal * 100).toFixed(1)}%`, background: a.c, borderRadius: 4, transition: "width .6s" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-title)", marginBottom: 16 }}>💳 Fee Collection</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ background: isLight ? "#f0fdf4" : "#052e16", border: `1px solid ${isLight ? "#bbf7d0" : "#16653488"}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: isLight ? "#15803d" : "#4ade80", fontWeight: 700 }}>COLLECTED</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: isLight ? "#166534" : "#86efac", marginTop: 4 }}>₵{colFee.toLocaleString()}</div>
            </div>
            <div style={{ background: isLight ? "#fff1f2" : "#450a0a", border: `1px solid ${isLight ? "#fecdd3" : "#991b1b88"}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: isLight ? "#be123c" : "#f87171", fontWeight: 700 }}>OUTSTANDING</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: isLight ? "#9f1239" : "#fca5a5", marginTop: 4 }}>₵{parseFloat(fees.total_outstanding || 0).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ height: 8, background: "var(--bg-input)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totFee ? ((colFee / totFee) * 100).toFixed(1) : 0}%`, background: "linear-gradient(90deg,#059669,#10b981)", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-label)", marginTop: 6 }}>{totFee ? Math.round(colFee / totFee * 100) : 0}% of total fees collected</div>
        </div>
      </div>
      {students?.students?.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-title)", marginBottom: 16 }}>👤 Recent Students</div>
          <table className="tbl">
            <thead><tr><th>Name</th><th>ID</th><th>Class</th><th>Gender</th><th>Guardian</th></tr></thead>
            <tbody>
              {students.students.slice(0, 4).map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{s.name}</td>
                  <td><span className="badge badge-blue">{s.student_id}</span></td>
                  <td>{s.class_name || "—"}</td>
                  <td><span className={`badge badge-${s.gender.toLowerCase()}`}>{s.gender}</span></td>
                  <td>{s.guardian || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────────
function Studs({ user, N }) {
  const [m, setM] = useState(null);
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("");
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const can = user.role === "Admin" || user.role === "Teacher";

  const { data: res, loading, reload } = useData(() => API.students.list({ search: q, classId: fc }), [q, fc]);
  const { data: cls } = useData(() => API.classes.list());
  const list = res?.students || [];

  const save = async () => {
    if (!f.name || !f.classId) { N("Name and class required", false); return; }
    setSaving(true);
    const dobValue = f.dateOfBirth || f.date_of_birth || null;
    try {
      if (m === "add") await API.students.create({ studentId: f.studentId, name: f.name, classId: +f.classId, age: +f.age || null, gender: f.gender, phone: f.phone, guardian: f.guardian, guardianPhone: f.guardianPhone, address: f.address, dateOfBirth: dobValue });
      else await API.students.update(f.id, { name: f.name, classId: +f.classId, age: +f.age || null, gender: f.gender, phone: f.phone, guardian: f.guardian, guardianPhone: f.guardianPhone, address: f.address, dateOfBirth: dobValue });
      N(m === "add" ? "Student added" : "Student updated"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this student?")) return;
    try { await API.students.delete(id); N("Student removed"); reload(); }
    catch (e) { N(e.message, false); }
  };

  return (
    <div className="anim">
      <PH title="Student Management" sub={`${list.length} enrolled`}
        btn={can && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="be" onClick={() => downloadCSV(list, "students_export.csv", {
              student_id: "Student ID",
              name: "Full Name",
              class_name: "Class",
              date_of_birth: "Date of Birth",
              age: "Age",
              gender: "Gender",
              phone: "Phone",
              guardian: "Guardian Name",
              guardian_phone: "Guardian Phone",
              address: "Address"
            })} disabled={!list.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9, fontSize: 13, opacity: !list.length ? 0.5 : 1, cursor: !list.length ? "not-allowed" : "pointer" }}>
              <span>📥</span> Export CSV
            </button>
            <button className="bp" onClick={() => { setF({ name: "", studentId: `STU-00${(list.length + 1)}`, classId: "", age: "", gender: "Male", phone: "", guardian: "", guardianPhone: "", address: "", dateOfBirth: "" }); setM("add"); }}>+ Add Student</button>
          </div>
        )} />
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input className="inp" placeholder="🔍 Search name or ID…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
          <select className="inp" value={fc} onChange={e => setFc(e.target.value)} style={{ width: 170 }}>
            <option value="">All Classes</option>
            {(cls || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {loading ? <Loading /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Name</th><th>ID</th><th>Class</th><th>Age</th><th>Gender</th><th>Guardian</th><th>Phone</th>{can && <th>Actions</th>}</tr></thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--text-label)" }}>{i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className={`av badge-${s.gender.toLowerCase()}`}>
                          {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--text-title)" }}>{s.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-blue">{s.student_id}</span></td>
                    <td>{s.class_name || "—"}</td>
                    <td>{s.age || "—"}</td>
                    <td><span className={`badge badge-${s.gender.toLowerCase()}`}>{s.gender}</span></td>
                    <td>{s.guardian || "—"}</td>
                    <td>{s.phone || "—"}</td>
                    {can && <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="be" onClick={() => { setF({ ...s, classId: s.class_id }); setM("edit"); }}>Edit</button>
                        <button className="bd" onClick={() => del(s.id)}>Del</button>
                      </div>
                    </td>}
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-label)" }}>No students found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(m === "add" || m === "edit") && (
        <Modal title={m === "add" ? "Add Student" : "Edit Student"} onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Full Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
            <Fld label="Student ID"><input className="inp" value={f.studentId || f.student_id || ""} onChange={e => setF(x => ({ ...x, studentId: e.target.value }))} /></Fld>
            <Fld label="Class"><select className="inp" value={f.classId || ""} onChange={e => setF(x => ({ ...x, classId: e.target.value }))}>
              <option value="">Select Class</option>{(cls || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></Fld>
            <Fld label="Date of Birth"><input className="inp" type="date" value={formatDateForInput(f.dateOfBirth || f.date_of_birth || "")} onChange={e => setF(x => ({ ...x, dateOfBirth: e.target.value }))} /></Fld>
            <Fld label="Age"><input className="inp" type="number" value={f.age || ""} onChange={e => setF(x => ({ ...x, age: e.target.value }))} /></Fld>
            <Fld label="Gender"><select className="inp" value={f.gender || "Male"} onChange={e => setF(x => ({ ...x, gender: e.target.value }))}><option>Male</option><option>Female</option></select></Fld>
            <Fld label="Phone"><input className="inp" value={f.phone || ""} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} /></Fld>
            <div></div> {/* Empty spacer to align the next row perfectly */}
            <Fld label="Guardian Name"><input className="inp" value={f.guardian || ""} onChange={e => setF(x => ({ ...x, guardian: e.target.value }))} /></Fld>
            <Fld label="Guardian Phone"><input className="inp" value={f.guardianPhone || f.guardian_phone || ""} onChange={e => setF(x => ({ ...x, guardianPhone: e.target.value }))} /></Fld>
          </div>
          <Fld label="Address"><input className="inp" value={f.address || ""} onChange={e => setF(x => ({ ...x, address: e.target.value }))} /></Fld>
          <SaveCancel onSave={save} onCancel={() => setM(null)} label={m === "add" ? "Add Student" : "Save Changes"} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Teachers ──────────────────────────────────────────────────────────────────
function Tchrs({ user, N }) {
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const { data: teachers, loading, reload } = useData(() => API.teachers.list());
  const { data: subjects } = useData(() => API.subjects.list());
  const { data: classes } = useData(() => API.classes.list());
  const list = teachers || [];

  const tog = (k, v) => setF(x => ({ ...x, [k]: x[k]?.includes(v) ? x[k].filter(i => i !== v) : [...(x[k] || []), v] }));

  const save = async () => {
    if (!f.name) { N("Name required", false); return; }
    setSaving(true);
    try {
      if (m === "add") await API.teachers.create({ staffId: f.staffId, name: f.name, email: f.email, phone: f.phone, gender: f.gender, qualification: f.qualification, subjects: f.subjects || [], classes: f.classes || [] });
      else await API.teachers.update(f.id, { name: f.name, email: f.email, phone: f.phone, gender: f.gender, qualification: f.qualification, subjects: f.subjects || [], classes: f.classes || [] });
      N(m === "add" ? "Teacher added" : "Updated"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const delTeacher = async (id, name) => {
    if (!window.confirm(`Delete teacher "${name}"? This cannot be undone.`)) return;
    try { await API.teachers.delete(id); N("Teacher removed"); reload(); }
    catch (e) { N(e.message, false); }
  };

  if (loading) return <Loading />;

  return (
    <div className="anim">
      <PH title="Teacher Management" sub={`${list.length} staff`}
        btn={user.role === "Admin" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="be" onClick={() => {
              const teachersToExport = list.map(t => {
                const teacherSubjects = (subjects || [])
                  .filter(s => t.subjects?.includes(s.id))
                  .map(s => s.name)
                  .join(", ");
                const teacherClasses = (classes || [])
                  .filter(c => t.classes?.includes(c.id))
                  .map(c => c.name)
                  .join(", ");
                return {
                  ...t,
                  assigned_subjects: teacherSubjects || "None",
                  assigned_classes: teacherClasses || "None"
                };
              });
              downloadCSV(teachersToExport, "teachers_export.csv", {
                staff_id: "Staff ID",
                name: "Full Name",
                email: "Email",
                phone: "Phone",
                gender: "Gender",
                qualification: "Qualification",
                assigned_subjects: "Assigned Subjects",
                assigned_classes: "Assigned Classes"
              });
            }} disabled={!list.length} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9, fontSize: 13, opacity: !list.length ? 0.5 : 1, cursor: !list.length ? "not-allowed" : "pointer" }}>
              <span>📥</span> Export CSV
            </button>
            <button className="bp" onClick={() => { setF({ name: "", staffId: `TCH-00${list.length + 1}`, email: "", phone: "", gender: "Male", qualification: "", subjects: [], classes: [] }); setM("add"); }}>+ Add Teacher</button>
          </div>
        )} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))", gap: 16 }}>
        {list.map(t => {
          const subs = (subjects || []).filter(s => t.subjects?.includes(s.id));
          const cls = (classes || []).filter(c => t.classes?.includes(c.id));
          return (
            <div key={t.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div className={`av badge-${t.gender.toLowerCase()}`} style={{ width: 52, height: 52, borderRadius: 14, fontSize: 18, flexShrink: 0 }}>
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-title)", fontSize: 15 }}>{t.name}</div>
                  <div style={{ color: "var(--text-label)", fontSize: 12 }}>{t.staff_id}</div>
                  <div style={{ color: "var(--text-main)", fontSize: 12, marginTop: 2 }}>{t.qualification}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {subs.map(s => <span key={s.id} className="badge badge-blue">{s.name}</span>)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {cls.map(c => <span key={c.id} className="badge badge-green">{c.name}</span>)}
              </div>
              <div style={{ borderTop: "1px solid var(--border-main)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-label)" }}>📞 {t.phone || "—"}</span>
                {user.role === "Admin" && <div style={{ display: "flex", gap: 6 }}>
                  <button className="be" onClick={() => { setF({ ...t, subjects: [...(t.subjects || [])], classes: [...(t.classes || [])] }); setM("edit"); }}>Edit</button>
                  <button className="bd" onClick={() => delTeacher(t.id, t.name)}>🗑 Delete</button>
                </div>}
              </div>
            </div>
          );
        })}
      </div>
      {(m === "add" || m === "edit") && (
        <Modal title={m === "add" ? "Add Teacher" : "Edit Teacher"} onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Full Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
            <Fld label="Staff ID"><input className="inp" value={f.staffId || f.staff_id || ""} onChange={e => setF(x => ({ ...x, staffId: e.target.value }))} /></Fld>
            <Fld label="Email"><input className="inp" type="email" value={f.email || ""} onChange={e => setF(x => ({ ...x, email: e.target.value }))} /></Fld>
            <Fld label="Phone"><input className="inp" value={f.phone || ""} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} /></Fld>
            <Fld label="Gender"><select className="inp" value={f.gender || "Male"} onChange={e => setF(x => ({ ...x, gender: e.target.value }))}><option>Male</option><option>Female</option></select></Fld>
            <Fld label="Qualification"><input className="inp" value={f.qualification || ""} onChange={e => setF(x => ({ ...x, qualification: e.target.value }))} /></Fld>
          </div>
          <Fld label="Subjects"><div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
            {(subjects || []).map(s => <button key={s.id} onClick={() => tog("subjects", s.id)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: f.subjects?.includes(s.id) ? "#1d4ed8" : "var(--bg-hover)", color: f.subjects?.includes(s.id) ? "#fff" : "var(--text-label)", fontFamily: "inherit" }}>{s.name}</button>)}
          </div></Fld>
          <Fld label="Classes"><div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
            {(classes || []).map(c => <button key={c.id} onClick={() => tog("classes", c.id)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: f.classes?.includes(c.id) ? "#059669" : "var(--bg-hover)", color: f.classes?.includes(c.id) ? "#fff" : "var(--text-label)", fontFamily: "inherit" }}>{c.name}</button>)}
          </div></Fld>
          <SaveCancel onSave={save} onCancel={() => setM(null)} label={m === "add" ? "Add Teacher" : "Save"} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Classes & Subjects ────────────────────────────────────────────────────────
function Cls({ user, N, isLight }) {
  const [tab, setTab] = useState("cls");
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const can = user.role === "Admin";

  const { data: classes, reload: reloadCls } = useData(() => API.classes.list());
  const { data: subjects, reload: reloadSub } = useData(() => API.subjects.list());
  const { data: teachers } = useData(() => API.teachers.list());

  const saveCls = async () => {
    if (!f.name) { N("Name required", false); return; }
    setSaving(true);
    try {
      if (m === "ac") await API.classes.create({ name: f.name, level: f.level || "JHS", capacity: +f.capacity || 40, teacherId: f.teacherId || null });
      else await API.classes.update(f.id, { name: f.name, level: f.level, capacity: +f.capacity, teacherId: f.teacherId || null });
      N("Saved"); setM(null); reloadCls();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const saveSub = async () => {
    if (!f.name) { N("Name required", false); return; }
    setSaving(true);
    try {
      if (m === "as") await API.subjects.create({ name: f.name, code: f.code, classIds: f.classIds || [] });
      else await API.subjects.update(f.id, { name: f.name, code: f.code, classIds: f.classIds || [] });
      N("Saved"); setM(null); reloadSub();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const togCls = id => setF(x => ({ ...x, classIds: x.classIds?.includes(id) ? x.classIds.filter(i => i !== id) : [...(x.classIds || []), id] }));

  const deleteCls = async (id, name) => {
    if (!window.confirm(`Delete class "${name}"? This cannot be undone.`)) return;
    try { await API.classes.delete(id); N("Class deleted"); reloadCls(); }
    catch (e) { N(e.message || "Failed to delete class", false); }
  };

  const deleteSub = async (id, name) => {
    if (!window.confirm(`Delete subject "${name}"? This cannot be undone.`)) return;
    try { await API.subjects.delete(id); N("Subject deleted"); reloadSub(); }
    catch (e) { N(e.message || "Failed to delete subject", false); }
  };

  return (
    <div className="anim">
      <PH title="Classes & Subjects" sub="Manage academic structure"
        btn={can && <button className="bp" onClick={() => { if (tab === "cls") { setF({ name: "", level: "JHS", capacity: 40, teacherId: "" }); setM("ac"); } else { setF({ name: "", code: "", classIds: [] }); setM("as"); } }}>+ Add {tab === "cls" ? "Class" : "Subject"}</button>} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`tab${tab === "cls" ? " on" : ""}`} onClick={() => setTab("cls")}>🏫 Classes ({(classes || []).length})</button>
        <button className={`tab${tab === "sub" ? " on" : ""}`} onClick={() => setTab("sub")}>📚 Subjects ({(subjects || []).length})</button>
      </div>
      {tab === "cls" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14 }}>
          {(classes || []).map(c => {
            const t = (teachers || []).find(x => x.id === c.teacher_id);
            return (
              <div key={c.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏫</div>
                  <span className="badge badge-green" style={{ alignSelf: "flex-start" }}>{c.level}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-title)", marginBottom: 4 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-main)", marginBottom: 13 }}>Teacher: {t?.name || c.teacher_name || "Unassigned"}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 13 }}>
                  {[{ l: "Students", v: c.student_count || 0, c: isLight ? "#1d4ed8" : "#60a5fa" }, { l: "Capacity", v: c.capacity, c: isLight ? "#15803d" : "#86efac" }].map(x => (
                    <div key={x.l} style={{ flex: 1, background: "var(--bg-main)", border: "1px solid var(--border-main)", borderRadius: 9, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 22, color: x.c }}>{x.v}</div>
                      <div style={{ fontSize: 11, color: "var(--text-label)" }}>{x.l}</div>
                    </div>
                  ))}
                </div>
                {can && <div style={{ display: "flex", gap: 8 }}>
                  <button className="be" style={{ flex: 1 }} onClick={() => { setF({ ...c, teacherId: c.teacher_id || "" }); setM("ec"); }}>Edit</button>
                  <button className="bd" style={{ flex: 1 }} onClick={() => deleteCls(c.id, c.name)}>🗑 Delete</button>
                </div>}
              </div>
            );
          })}
        </div>
      )}
      {tab === "sub" && (
        <div className="card"><table className="tbl">
          <thead><tr><th>Subject</th><th>Code</th><th>Classes</th>{can && <th>Actions</th>}</tr></thead>
          <tbody>
            {(subjects || []).map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{s.name}</td>
                <td><span className="badge badge-purple" style={{ fontFamily: "'DM Mono',monospace" }}>{s.code}</span></td>
                <td><div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(s.class_ids || []).map(id => { const cl = (classes || []).find(c => c.id === id); return cl ? <span key={id} className="badge badge-green">{cl.name}</span> : null; })}
                </div></td>
                {can && <td><div style={{ display: "flex", gap: 6 }}><button className="be" onClick={() => { setF({ ...s, classIds: [...(s.class_ids || [])] }); setM("es"); }}>Edit</button><button className="bd" onClick={() => deleteSub(s.id, s.name)}>🗑 Delete</button></div></td>}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {(m === "ac" || m === "ec") && <Modal title={m === "ac" ? "Add Class" : "Edit Class"} onClose={() => setM(null)}>
        <Fld label="Class Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Fld label="Level"><select className="inp" value={f.level || "JHS"} onChange={e => setF(x => ({ ...x, level: e.target.value }))}><option>Nursery</option><option>KG</option><option>Primary</option><option>JHS</option><option>SHS</option></select></Fld>
          <Fld label="Capacity"><input className="inp" type="number" value={f.capacity || ""} onChange={e => setF(x => ({ ...x, capacity: e.target.value }))} /></Fld>
        </div>
        <Fld label="Class Teacher"><select className="inp" value={f.teacherId || ""} onChange={e => setF(x => ({ ...x, teacherId: e.target.value }))}>
          <option value="">None</option>{(teachers || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></Fld>
        <SaveCancel onSave={saveCls} onCancel={() => setM(null)} saving={saving} />
      </Modal>}
      {(m === "as" || m === "es") && <Modal title={m === "as" ? "Add Subject" : "Edit Subject"} onClose={() => setM(null)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Fld label="Subject Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
          <Fld label="Code"><input className="inp" value={f.code || ""} onChange={e => setF(x => ({ ...x, code: e.target.value }))} /></Fld>
        </div>
        <Fld label="Assign to Classes"><div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
          {(classes || []).map(c => <button key={c.id} onClick={() => togCls(c.id)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: f.classIds?.includes(c.id) ? "#059669" : "var(--bg-hover)", color: f.classIds?.includes(c.id) ? "#fff" : "var(--text-label)", fontFamily: "inherit" }}>{c.name}</button>)}
        </div></Fld>
        <SaveCancel onSave={saveSub} onCancel={() => setM(null)} saving={saving} />
      </Modal>}
    </div>
  );
}

// ── Attendance ────────────────────────────────────────────────────────────────
function Att({ user, N, isLight }) {
  const [tab, setTab] = useState("mark");
  const [date, setDate] = useState(todayStr());
  const [cid, setCid] = useState("");
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState({});
  const can = user.role === "Admin" || user.role === "Teacher";

  const { data: classes } = useData(() => API.classes.list());
  const effectiveCid = cid || classes?.[0]?.id || "";

  const { data: studs } = useData(
    () => effectiveCid ? API.students.list({ classId: effectiveCid }) : Promise.resolve({ students: [] }),
    [effectiveCid]
  );
  const { data: attData, reload: reloadAtt } = useData(
    () => effectiveCid ? API.attendance.list({ classId: effectiveCid, date }) : Promise.resolve([]),
    [effectiveCid, date]
  );

  // Sync status map from fetched attendance
  useEffect(() => {
    const map = {};
    (attData || []).forEach(a => { map[a.student_id] = a.status; });
    setStatuses(map);
  }, [attData]);

  const students = studs?.students || [];

  const saveAll = async () => {
    if (!effectiveCid) { N("Select a class", false); return; }
    setSaving(true);
    try {
      const records = students.map(s => ({ studentId: s.id, status: statuses[s.id] || "Present" }));
      await API.attendance.markBulk(+effectiveCid, date, records);
      N(`Attendance saved for ${records.length} students`); reloadAtt();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const deleteAttRecord = async (studentId, studentName) => {
    const rec = (attData || []).find(a => a.student_id === studentId);
    if (!rec) { N("No saved record to delete for this student", false); return; }
    if (!window.confirm(`Delete attendance record for "${studentName}" on ${date}?`)) return;
    try { await API.attendance.delete(rec.id); N("Record deleted"); reloadAtt(); }
    catch (e) { N(e.message, false); }
  };

  const updateAttRecord = async (studentId, newStatus) => {
    const rec = (attData || []).find(a => a.student_id === studentId);
    if (!rec) { setStatuses(m => ({ ...m, [studentId]: newStatus })); return; }
    try { await API.attendance.update(rec.id, { status: newStatus }); reloadAtt(); }
    catch (e) { N(e.message, false); }
  };

  const { data: reportData } = useData(
    () => effectiveCid ? API.attendance.report(effectiveCid) : Promise.resolve([]),
    [effectiveCid]
  );

  return (
    <div className="anim">
      <PH title="Attendance" sub="Daily student attendance tracking" />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`tab${tab === "mark" ? " on" : ""}`} onClick={() => setTab("mark")}>✏️ Mark</button>
        <button className={`tab${tab === "rep" ? " on" : ""}`} onClick={() => setTab("rep")}>📊 Report</button>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <div><label className="lbl">Class</label>
          <select className="inp" value={effectiveCid} onChange={e => setCid(e.target.value)} style={{ width: 190 }}>
            {(classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="lbl">Date</label>
          <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 170 }} />
        </div>
      </div>
      {tab === "mark" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: "var(--text-title)" }}>{(classes || []).find(c => c.id === +effectiveCid)?.name} — {date}</div>
            {can && <button className="bp" onClick={saveAll} disabled={saving}>{saving ? <><Spinner /> Saving…</> : "💾 Save Attendance"}</button>}
          </div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Student</th><th>Status</th>{can && <th>Actions</th>}</tr></thead>
            <tbody>
              {students.map((s, i) => {
                const st = statuses[s.id] || "Present";
                const saved = (attData || []).find(a => a.student_id === s.id);
                return (
                  <tr key={s.id}>
                    <td style={{ color: "var(--text-label)" }}>{i + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: SC[st] }} />
                        <span style={{ fontWeight: 600, color: "var(--text-title)" }}>{s.name}</span>
                        <span style={{ color: "var(--text-label)", fontSize: 12 }}>{s.student_id}</span>
                        {saved && <span className="badge badge-green" style={{ fontSize: 10 }}>Saved</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["Present", "Absent", "Late"].map(x => (
                          <button key={x} disabled={!can} onClick={() => { setStatuses(m => ({ ...m, [s.id]: x })); if (saved) updateAttRecord(s.id, x); }}
                            style={{ padding: "5px 12px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600, cursor: can ? "pointer" : "default", background: st === x ? SC[x] + "28" : "var(--bg-hover)", color: st === x ? SC[x] : "var(--text-label)", outline: st === x ? `1px solid ${SC[x]}60` : "none", fontFamily: "inherit" }}>
                            {x}
                          </button>
                        ))}
                      </div>
                    </td>
                    {can && <td>
                      {saved
                        ? <button className="bd" onClick={() => deleteAttRecord(s.id, s.name)}>🗑 Delete</button>
                        : <span style={{ fontSize: 12, color: "var(--text-label)" }}>Not saved</span>}
                    </td>}
                  </tr>
                );
              })}
              {!students.length && <tr><td colSpan={3} style={{ textAlign: "center", padding: 28, color: "var(--text-label)" }}>No students in this class</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "rep" && (
        <div className="card">
          <div style={{ fontWeight: 600, color: "var(--text-title)", marginBottom: 14 }}>Attendance Summary — {(classes || []).find(c => c.id === +effectiveCid)?.name}</div>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>% Present</th></tr></thead>
            <tbody>
              {(reportData || []).map(r => {
                const pct = r.total > 0 ? Math.round(r.present / r.total * 100) : 0;
                const pColor = pct >= 80 ? (isLight ? "#15803d" : "#10b981") : pct >= 60 ? (isLight ? "#b45309" : "#f59e0b") : (isLight ? "#b91c1c" : "#ef4444");
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.name}</td>
                    <td style={{ color: isLight ? "#15803d" : "#10b981", fontWeight: 600 }}>{r.present}</td>
                    <td style={{ color: isLight ? "#b91c1c" : "#ef4444", fontWeight: 600 }}>{r.absent}</td>
                    <td style={{ color: isLight ? "#b45309" : "#f59e0b", fontWeight: 600 }}>{r.late}</td>
                    <td>{r.total}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 56, height: 6, background: "var(--bg-input)", border: "1px solid var(--border-main)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pColor, minWidth: 34 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!(reportData || []).length && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-label)" }}>No attendance data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Exams ─────────────────────────────────────────────────────────────────────
function Exam({ user, N, isLight }) {
  const [tab, setTab] = useState("exams");
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [sc, setSc] = useState({});
  const [rc, setRc] = useState("");
  const [saving, setSaving] = useState(false);
  const can = user.role === "Admin" || user.role === "Teacher";

  const { data: exams, reload } = useData(() => API.exams.list());
  const { data: classes } = useData(() => API.classes.list());
  const { data: subjects } = useData(() => API.subjects.list());
  const { data: studs } = useData(() => API.students.list());
  const students = studs?.students || [];

  const { data: rcData } = useData(
    () => rc ? API.exams.reportCard(rc) : Promise.resolve(null),
    [rc]
  );

  const addExam = async () => {
    if (!f.name || !f.classId) { N("Fill required fields", false); return; }
    setSaving(true);
    try { await API.exams.create({ name: f.name, term: f.term, year: f.year || "2025", classId: +f.classId, subjectId: +f.subjectId || null, date: f.date || null, totalMarks: +f.totalMarks || 100 }); N("Exam created"); setM(null); reload(); }
    catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const editExam = async () => {
    if (!f.name || !f.classId) { N("Fill required fields", false); return; }
    setSaving(true);
    try { await API.exams.update(f.id, { name: f.name, term: f.term, year: f.year, classId: +f.classId, subjectId: +f.subjectId || null, date: f.date || null, totalMarks: +f.totalMarks || 100 }); N("Exam updated"); setM(null); reload(); }
    catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const deleteExam = async (id, name) => {
    if (!window.confirm(`Delete exam "${name}"? All scores will be lost.`)) return;
    try { await API.exams.delete(id); N("Exam deleted"); reload(); }
    catch (e) { N(e.message, false); }
  };

  const openSc = async (ex) => {
    const r = await API.exams.results({ examId: ex.id });
    const map = {};
    r.forEach(x => { map[x.student_id] = x.score; });
    setSc(map); setM({ type: "sc", exam: ex });
  };

  const saveSc = async () => {
    setSaving(true);
    try {
      const classStudents = students.filter(s => s.class_id === m.exam.class_id || s.classId === m.exam.class_id);
      const scores = classStudents.map(s => ({ studentId: s.id, score: sc[s.id] })).filter(x => x.score !== "" && x.score !== undefined);
      await API.exams.saveScores(m.exam.id, scores);
      N("Scores saved"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const rcStudent = students.find(s => s.id === +rc);
  const avg = rcData?.average || 0;
  const ag = gradeOf(avg);

  return (
    <div className="anim">
      <PH title="Exams & Results" sub="Manage assessments"
        btn={can && tab === "exams" && <button className="bp" onClick={() => { setF({ name: "", term: "Term 1", year: "2025", classId: "", subjectId: "", date: todayStr(), totalMarks: 100 }); setM({ type: "add" }); }}>+ Create Exam</button>} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`tab${tab === "exams" ? " on" : ""}`} onClick={() => setTab("exams")}>📝 Exams</button>
        <button className={`tab${tab === "rc" ? " on" : ""}`} onClick={() => setTab("rc")}>📄 Report Card</button>
      </div>
      {tab === "exams" && (
        <div className="card"><table className="tbl">
          <thead><tr><th>Exam</th><th>Class</th><th>Subject</th><th>Date</th><th>Term</th><th>Max</th><th>Scored</th>{can && <th>Action</th>}</tr></thead>
          <tbody>
            {(exams || []).map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{e.name}</td>
                <td>{e.class_name}</td>
                <td><span className="badge badge-blue">{e.subject_name}</span></td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{e.date || "—"}</td>
                <td><span className="badge badge-purple">{e.term}</span></td>
                <td>{e.total_marks}</td>
                <td><span style={{ color: isLight ? "#b45309" : "#f59e0b", fontWeight: 700 }}>{e.scored_count || 0}</span></td>
                {can && <td><div style={{ display: "flex", gap: 6 }}>
                  <button className="be" onClick={() => { setF({ ...e, classId: e.class_id, subjectId: e.subject_id }); setM({ type: "edit" }); }}>Edit</button>
                  <button className="be" onClick={() => openSc(e)}>Enter Scores</button>
                  <button className="bd" onClick={() => deleteExam(e.id, e.name)}>🗑</button>
                </div></td>}
              </tr>
            ))}
            {!(exams || []).length && <tr><td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--text-label)" }}>No exams yet</td></tr>}
          </tbody>
        </table></div>
      )}
      {tab === "rc" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">Student</label>
            <select className="inp" value={rc} onChange={e => setRc(e.target.value)} style={{ width: 300 }}>
              <option value="">Select a student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>)}
            </select>
          </div>
          {rcData && rcStudent && (
            <div className="card">
              <div style={{ textAlign: "center", borderBottom: "1px solid var(--border-main)", paddingBottom: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "var(--text-label)", fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>ACADEMIC REPORT CARD</div>
                <div style={{ fontWeight: 800, fontSize: 24, color: "var(--text-title)" }}>{rcStudent.name}</div>
                <div style={{ color: "var(--text-label)", fontSize: 13, marginTop: 4 }}>{rcStudent.student_id}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[{ l: "AVG SCORE", v: `${avg}%`, c: getGradeColor(ag.c, isLight) }, { l: "GRADE", v: ag.g, c: getGradeColor(ag.c, isLight) }, { l: "EXAMS TAKEN", v: (rcData.results || []).length, c: isLight ? "#1d4ed8" : "#60a5fa" }].map(x => (
                  <div key={x.l} style={{ background: "var(--bg-main)", border: "1px solid var(--border-main)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 28, color: x.c }}>{x.v}</div>
                    <div style={{ fontSize: 11, color: "var(--text-label)", fontWeight: 700, letterSpacing: .5 }}>{x.l}</div>
                  </div>
                ))}
              </div>
              <table className="tbl">
                <thead><tr><th>Subject</th><th>Exam</th><th>Term</th><th>Score</th><th>Grade</th><th>Remark</th></tr></thead>
                <tbody>
                  {(rcData.results || []).map((r, i) => {
                    const g = gradeOf(r.score);
                    const gc = getGradeColor(g.c, isLight);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.subject_name}</td>
                        <td>{r.exam_name}</td>
                        <td><span className="badge badge-purple">{r.term}</span></td>
                        <td style={{ fontWeight: 700, color: gc, fontFamily: "'DM Mono',monospace" }}>{r.score}/{r.total_marks}</td>
                        <td><span className="badge" style={{ background: gc + "22", color: gc }}>{g.g}</span></td>
                        <td style={{ color: "var(--text-main)" }}>{g.l}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {m?.type === "add" && (
        <Modal title="Create Exam" onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Exam Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
            <Fld label="Term"><select className="inp" value={f.term || "Term 1"} onChange={e => setF(x => ({ ...x, term: e.target.value }))}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></Fld>
            <Fld label="Class"><select className="inp" value={f.classId || ""} onChange={e => setF(x => ({ ...x, classId: e.target.value }))}><option value="">Select</option>{(classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
            <Fld label="Subject"><select className="inp" value={f.subjectId || ""} onChange={e => setF(x => ({ ...x, subjectId: e.target.value }))}><option value="">Select</option>{(subjects || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
            <Fld label="Date"><input className="inp" type="date" value={f.date || ""} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Fld>
            <Fld label="Total Marks"><input className="inp" type="number" value={f.totalMarks || 100} onChange={e => setF(x => ({ ...x, totalMarks: e.target.value }))} /></Fld>
          </div>
          <SaveCancel onSave={addExam} onCancel={() => setM(null)} label="Create Exam" saving={saving} />
        </Modal>
      )}
      {m?.type === "edit" && (
        <Modal title="Edit Exam" onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Exam Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
            <Fld label="Term"><select className="inp" value={f.term || "Term 1"} onChange={e => setF(x => ({ ...x, term: e.target.value }))}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></Fld>
            <Fld label="Class"><select className="inp" value={f.classId || ""} onChange={e => setF(x => ({ ...x, classId: e.target.value }))}><option value="">Select</option>{(classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
            <Fld label="Subject"><select className="inp" value={f.subjectId || ""} onChange={e => setF(x => ({ ...x, subjectId: e.target.value }))}><option value="">Select</option>{(subjects || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
            <Fld label="Date"><input className="inp" type="date" value={f.date || ""} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Fld>
            <Fld label="Total Marks"><input className="inp" type="number" value={f.totalMarks || f.total_marks || 100} onChange={e => setF(x => ({ ...x, totalMarks: e.target.value }))} /></Fld>
          </div>
          <SaveCancel onSave={editExam} onCancel={() => setM(null)} label="Save Changes" saving={saving} />
        </Modal>
      )}
      {m?.type === "sc" && (
        <Modal title={`Enter Scores — ${m.exam.name}`} onClose={() => setM(null)}>
          <div style={{ marginBottom: 14, color: "var(--text-label)", fontSize: 13 }}>
            {m.exam.class_name} · {m.exam.subject_name} · Max: {m.exam.total_marks}
          </div>
          <table className="tbl">
            <thead><tr><th>Student</th><th>Score / {m.exam.total_marks}</th><th>Grade</th></tr></thead>
            <tbody>
              {students.filter(s => s.class_id === m.exam.class_id).map(s => {
                const v = sc[s.id] ?? ""; const g = v !== "" ? gradeOf(+v) : null;
                const gc = g ? getGradeColor(g.c, isLight) : "";
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{s.name}</td>
                    <td><input className="inp" type="number" min={0} max={m.exam.total_marks} value={v} onChange={e => setSc(x => ({ ...x, [s.id]: e.target.value }))} style={{ width: 90 }} /></td>
                    <td>{g && <span className="badge" style={{ background: gc + "22", color: gc }}>{g.g}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SaveCancel onSave={saveSc} onCancel={() => setM(null)} label="Save Scores" saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Fees ──────────────────────────────────────────────────────────────────────
function Fees({ user, N, isLight }) {
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [fil, setFil] = useState("all");
  const [saving, setSaving] = useState(false);

  const { data: feeList, reload } = useData(() => API.fees.list(fil !== "all" ? { status: fil } : {}), [fil]);
  const { data: summary } = useData(() => API.fees.summary());
  const { data: studs } = useData(() => API.students.list());
  const students = studs?.students || [];
  const rows = feeList || [];

  const pay = async () => {
    if (!f.studentId || !f.amount) { N("Fill required fields", false); return; }
    setSaving(true);
    try {
      await API.fees.create({ studentId: +f.studentId, amount: +f.amount, paid: +f.paid || 0, term: f.term || "Term 1", year: f.year || "2025", date: f.date || null, method: f.method || null });
      N("Payment recorded"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const editFee = async () => {
    if (!f.amount) { N("Fill required fields", false); return; }
    setSaving(true);
    try {
      await API.fees.update(f.id, { amount: +f.amount, paid: +f.paid || 0, term: f.term, year: f.year, date: f.date || null, method: f.method || null });
      N("Fee record updated"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const deleteFee = async (id, studentName) => {
    if (!window.confirm(`Delete fee record for "${studentName}"? This cannot be undone.`)) return;
    try { await API.fees.delete(id); N("Fee record deleted"); reload(); }
    catch (e) { N(e.message, false); }
  };

  const remind = async (id) => {
    try { await API.fees.remind(id); N("Reminder email sent"); }
    catch (e) { N(e.message, false); }
  };

  const s = summary || {};
  return (
    <div className="anim">
      <PH title="Fee Management" sub="Track payments and balances"
        btn={user.role === "Admin" && <button className="bp" onClick={() => { setF({ studentId: "", amount: 800, paid: "", term: "Term 1", year: "2025", date: todayStr(), method: "Cash" }); setM(true); }}>+ Record Payment</button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        {[{ l: "Total Billed", v: `₵${parseFloat(s.total_billed || 0).toLocaleString()}`, c: isLight ? "#1d4ed8" : "#60a5fa", bg: isLight ? "#eff6ff" : "#0d1827" },
        { l: "Collected", v: `₵${parseFloat(s.total_collected || 0).toLocaleString()}`, c: isLight ? "#15803d" : "#86efac", bg: isLight ? "#dcfce7" : "#052e16" },
        { l: "Outstanding", v: `₵${parseFloat(s.total_outstanding || 0).toLocaleString()}`, c: isLight ? "#b91c1c" : "#fca5a5", bg: isLight ? "#fee2e2" : "#450a0a" }].map(x => (
          <div key={x.l} style={{ background: x.bg, border: `1px solid ${x.c}30`, borderRadius: 16, padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: x.c, fontWeight: 700, marginBottom: 5 }}>{x.l.toUpperCase()}</div>
            <div style={{ fontWeight: 800, fontSize: 24, color: x.c }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["all", "paid", "outstanding"].map(x => <button key={x} className={`tab${fil === x ? " on" : ""}`} onClick={() => setFil(x)}>{x === "all" ? "All" : x === "paid" ? "✅ Paid" : "⚠️ Outstanding"}</button>)}
      </div>
      <div className="card"><div style={{ overflowX: "auto" }}><table className="tbl">
        <thead><tr><th>Student</th><th>Term</th><th>Total</th><th>Paid</th><th>Balance</th><th>Method</th><th>Date</th><th>Receipt</th>{user.role === "Admin" && <th>Actions</th>}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.student_name} <span style={{ color: "var(--text-label)", fontSize: 11 }}>({r.student_code})</span></td>
              <td><span className="badge badge-purple">{r.term} {r.year}</span></td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.amount).toLocaleString()}</td>
              <td style={{ color: isLight ? "#15803d" : "#86efac", fontWeight: 600, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.paid).toLocaleString()}</td>
              <td style={{ color: parseFloat(r.balance) === 0 ? (isLight ? "#15803d" : "#10b981") : (isLight ? "#b91c1c" : "#ef4444"), fontWeight: 700, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.balance || 0).toLocaleString()}</td>
              <td>{r.method || "—"}</td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.date || "—"}</td>
              <td>{r.receipt_no ? <span className="badge badge-green">{r.receipt_no}</span> : "—"}</td>
              {user.role === "Admin" && <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="be" onClick={() => { setF({ ...r, studentId: r.student_id }); setM("edit"); }}>Edit</button>
                  {parseFloat(r.balance || 0) > 0 && <button className="be" onClick={() => remind(r.id)}>📧 Remind</button>}
                  <button className="bd" onClick={() => deleteFee(r.id, r.student_name)}>🗑</button>
                </div>
              </td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} style={{ textAlign: "center", padding: 28, color: "var(--text-label)" }}>No fee records</td></tr>}
        </tbody>
      </table></div></div>
      {m === true && (
        <Modal title="Record Fee Payment" onClose={() => setM(null)}>
          <Fld label="Student"><select className="inp" value={f.studentId || ""} onChange={e => setF(x => ({ ...x, studentId: e.target.value }))}>
            <option value="">Select Student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>)}
          </select></Fld>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Term"><select className="inp" value={f.term || "Term 1"} onChange={e => setF(x => ({ ...x, term: e.target.value }))}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></Fld>
            <Fld label="Year"><input className="inp" value={f.year || "2025"} onChange={e => setF(x => ({ ...x, year: e.target.value }))} /></Fld>
            <Fld label="Total Fee (₵)"><input className="inp" type="number" value={f.amount || ""} onChange={e => setF(x => ({ ...x, amount: e.target.value }))} /></Fld>
            <Fld label="Amount Paid (₵)"><input className="inp" type="number" value={f.paid || ""} onChange={e => setF(x => ({ ...x, paid: e.target.value }))} /></Fld>
            <Fld label="Method"><select className="inp" value={f.method || "Cash"} onChange={e => setF(x => ({ ...x, method: e.target.value }))}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Cheque</option></select></Fld>
            <Fld label="Date"><input className="inp" type="date" value={f.date || todayStr()} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Fld>
          </div>
          <SaveCancel onSave={pay} onCancel={() => setM(null)} label="Save Payment" saving={saving} />
        </Modal>
      )}
      {m === "edit" && (
        <Modal title="Edit Fee Record" onClose={() => setM(null)}>
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--bg-main)", border: "1px solid var(--border-main)", borderRadius: 9, fontSize: 13, color: "var(--text-main)" }}>
            Student: <strong style={{ color: "var(--text-title)" }}>{f.student_name}</strong> &nbsp;·&nbsp; Receipt: <strong style={{ color: isLight ? "#15803d" : "#86efac" }}>{f.receipt_no}</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Term"><select className="inp" value={f.term || "Term 1"} onChange={e => setF(x => ({ ...x, term: e.target.value }))}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></Fld>
            <Fld label="Year"><input className="inp" value={f.year || "2025"} onChange={e => setF(x => ({ ...x, year: e.target.value }))} /></Fld>
            <Fld label="Total Fee (₵)"><input className="inp" type="number" value={f.amount || ""} onChange={e => setF(x => ({ ...x, amount: e.target.value }))} /></Fld>
            <Fld label="Amount Paid (₵)"><input className="inp" type="number" value={f.paid || ""} onChange={e => setF(x => ({ ...x, paid: e.target.value }))} /></Fld>
            <Fld label="Method"><select className="inp" value={f.method || "Cash"} onChange={e => setF(x => ({ ...x, method: e.target.value }))}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Cheque</option></select></Fld>
            <Fld label="Date"><input className="inp" type="date" value={f.date || todayStr()} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Fld>
          </div>
          <SaveCancel onSave={editFee} onCancel={() => setM(null)} label="Save Changes" saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Timetable ─────────────────────────────────────────────────────────────────
function TT({ user, N, isLight }) {
  const [cid, setCid] = useState("");
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const can = user.role === "Admin";

  const { data: classes } = useData(() => API.classes.list());
  const effectiveCid = cid || classes?.[0]?.id || "";
  const { data: tt, reload } = useData(
    () => effectiveCid ? API.timetable.list(effectiveCid) : Promise.resolve([]),
    [effectiveCid]
  );
  const { data: subjects } = useData(() => API.subjects.list());
  const { data: teachers } = useData(() => API.teachers.list());

  const getSlot = (d, p) => (tt || []).find(t => t.day === d && t.period === p);
  const getSlotStyle = (ci, isLight) => {
    const darkBgs = ["#0d1827", "#0a1f0f", "#180d2e", "#1c0a16", "#0a1a1f"];
    const lightBgs = ["#eff6ff", "#dcfce7", "#f3e8ff", "#fce7f3", "#ecfdf5"];
    const lightTexts = ["#1e40af", "#166534", "#5b21b6", "#9d174d", "#065f46"];
    const lightBorders = ["#bfdbfe", "#bbf7d0", "#e9d5ff", "#fbcfe8", "#a7f3d0"];

    if (isLight) {
      return {
        background: lightBgs[ci],
        color: lightTexts[ci],
        border: `1px solid ${lightBorders[ci]}`
      };
    } else {
      return {
        background: darkBgs[ci],
        color: "#f1f5f9",
        border: "1px solid var(--border-main)"
      };
    }
  };

  const save = async () => {
    if (!f.subjectId || !f.teacherId) { N("Fill all fields", false); return; }
    setSaving(true);
    try {
      await API.timetable.create({ classId: +effectiveCid, subjectId: +f.subjectId, teacherId: +f.teacherId, day: f.day, period: +f.period, startTime: f.startTime || null, endTime: f.endTime || null });
      N("Slot added"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const removeSlot = async (id) => {
    try { await API.timetable.delete(id); N("Slot removed"); reload(); }
    catch (e) { N(e.message, false); }
  };

  return (
    <div className="anim">
      <PH title="Timetable" sub="Weekly class schedule" />
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
        <div><label className="lbl">Class</label>
          <select className="inp" value={effectiveCid} onChange={e => setCid(e.target.value)} style={{ width: 200 }}>
            {(classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {can && <button className="bp" onClick={() => { setF({ day: "Monday", period: 1, subjectId: "", teacherId: "", startTime: "07:30", endTime: "08:30" }); setM(true); }}>+ Add Slot</button>}
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th style={{ width: 80 }}>Period</th>{DAYS.map(d => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {PERIODS.map((p, pi) => (
              <tr key={p}>
                <td style={{ verticalAlign: "top" }}>
                  <div style={{ fontWeight: 700, color: "var(--text-title)", fontSize: 12 }}>P{p}</div>
                  <div style={{ fontSize: 10, color: "var(--text-link)", fontWeight: 500 }}>{PT[pi]}</div>
                </td>
                {DAYS.map(d => {
                  const sl = getSlot(d, p);
                  const ci = sl ? (sl.subject_id || 0) % 5 : 0;
                  const styleVal = getSlotStyle(ci, isLight);
                  return (
                    <td key={d} style={{ verticalAlign: "top", padding: 5 }}>
                      {sl ? (
                        <div style={{ ...styleVal, borderRadius: 10, padding: "10px 11px", minHeight: 62, position: "relative" }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: styleVal.color, marginBottom: 3 }}>{sl.subject_name || "?"}</div>
                          <div style={{ fontSize: 11, color: isLight ? styleVal.color : "#94a3b8", opacity: 0.85 }}>{(sl.teacher_name || "").split(" ").slice(-1)[0]}</div>
                          {can && <button onClick={() => removeSlot(sl.id)}
                            style={{ position: "absolute", top: 4, right: 6, background: "none", border: "none", color: isLight ? styleVal.color : "#475569", cursor: "pointer", fontSize: 14 }}>×</button>}
                        </div>
                      ) : (
                        can && <button onClick={() => { setF({ day: d, period: p, subjectId: "", teacherId: "", startTime: PT[pi]?.split("–")[0], endTime: PT[pi]?.split("–")[1] }); setM(true); }}
                          style={{ width: "100%", minHeight: 62, background: "var(--bg-input)", border: "1px dashed var(--border-main)", borderRadius: 10, color: "var(--text-label)", cursor: "pointer", fontSize: 20, fontFamily: "inherit" }}>+</button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m && (
        <Modal title="Add Timetable Slot" onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Day"><select className="inp" value={f.day} onChange={e => setF(x => ({ ...x, day: e.target.value }))}>{DAYS.map(d => <option key={d}>{d}</option>)}</select></Fld>
            <Fld label="Period"><select className="inp" value={f.period} onChange={e => setF(x => ({ ...x, period: e.target.value }))}>{PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}</select></Fld>
            <Fld label="Subject"><select className="inp" value={f.subjectId} onChange={e => setF(x => ({ ...x, subjectId: e.target.value }))}><option value="">Select</option>{(subjects || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
            <Fld label="Teacher"><select className="inp" value={f.teacherId} onChange={e => setF(x => ({ ...x, teacherId: e.target.value }))}><option value="">Select</option>{(teachers || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Fld>
            <Fld label="Start Time"><input className="inp" type="time" value={f.startTime || ""} onChange={e => setF(x => ({ ...x, startTime: e.target.value }))} /></Fld>
            <Fld label="End Time"><input className="inp" type="time" value={f.endTime || ""} onChange={e => setF(x => ({ ...x, endTime: e.target.value }))} /></Fld>
          </div>
          <SaveCancel onSave={save} onCancel={() => setM(null)} label="Add Slot" saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function Rpt({ user, N, isLight }) {
  const [type, setType] = useState("att");
  const { data: attRpt } = useData(() => API.reports.attendance(), []);
  const { data: feeRpt } = useData(() => API.reports.fees(), []);
  const { data: resRpt } = useData(() => API.reports.results(), []);

  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>APS Report</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#1d4ed8;color:#fff}h1{color:#1d4ed8}tr:nth-child(even){background:#f0f4ff}</style></head><body>`);
    w.document.write(`<h1>Ambassador's Prep. School — ${type === "att" ? "Attendance" : type === "fee" ? "Fee" : "Results"} Report</h1><p>Generated: ${new Date().toLocaleString()}</p>`);
    w.document.write(document.getElementById("rpt-table")?.outerHTML || "<p>No data</p>");
    w.document.write("</body></html>"); w.document.close(); w.print();
  };

  return (
    <div className="anim">
      <PH title="Reports" sub="View and print school data" btn={<button className="bp" onClick={print}>🖨 Print</button>} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`tab${type === "att" ? " on" : ""}`} onClick={() => setType("att")}>📋 Attendance</button>
        <button className={`tab${type === "fee" ? " on" : ""}`} onClick={() => setType("fee")}>💳 Fees</button>
        <button className={`tab${type === "res" ? " on" : ""}`} onClick={() => setType("res")}>📝 Results</button>
      </div>
      <div className="card">
        {type === "att" && <table className="tbl" id="rpt-table">
          <thead><tr><th>Student</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>% Present</th></tr></thead>
          <tbody>{(attRpt || []).map((r, i) => {
            const pct = r.total > 0 ? Math.round(r.present / r.total * 100) : 0;
            const pColor = pct >= 80 ? (isLight ? "#15803d" : "#10b981") : pct >= 60 ? (isLight ? "#b45309" : "#f59e0b") : (isLight ? "#b91c1c" : "#ef4444");
            return (<tr key={i}>
              <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.name}</td>
              <td>{r.class_name || "—"}</td>
              <td style={{ color: isLight ? "#15803d" : "#10b981", fontWeight: 600 }}>{r.present}</td>
              <td style={{ color: isLight ? "#b91c1c" : "#ef4444", fontWeight: 600 }}>{r.absent}</td>
              <td style={{ color: isLight ? "#b45309" : "#f59e0b", fontWeight: 600 }}>{r.late}</td>
              <td>{r.total}</td>
              <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 60, height: 6, background: "var(--bg-input)", border: "1px solid var(--border-main)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: pColor }} /></div>
                <span style={{ color: pColor, fontWeight: 700, fontSize: 12 }}>{pct}%</span>
              </div></td>
            </tr>);
          })}</tbody>
        </table>}
        {type === "fee" && <table className="tbl" id="rpt-table">
          <thead><tr><th>Student</th><th>Term</th><th>Total</th><th>Paid</th><th>Balance</th><th>Method</th><th>Status</th></tr></thead>
          <tbody>{(feeRpt || []).map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.student_name}</td>
              <td><span className="badge badge-purple">{r.term} {r.year}</span></td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.amount).toLocaleString()}</td>
              <td style={{ color: isLight ? "#15803d" : "#86efac", fontWeight: 600, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.paid).toLocaleString()}</td>
              <td style={{ color: parseFloat(r.balance) > 0 ? (isLight ? "#b91c1c" : "#ef4444") : (isLight ? "#15803d" : "#10b981"), fontWeight: 700, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>₵{parseFloat(r.balance || 0).toLocaleString()}</td>
              <td>{r.method || "—"}</td>
              <td><span className={parseFloat(r.balance || 0) === 0 ? "badge badge-green" : "badge badge-danger"}>{parseFloat(r.balance || 0) === 0 ? "Cleared" : "Outstanding"}</span></td>
            </tr>
          ))}</tbody>
        </table>}
        {type === "res" && <table className="tbl" id="rpt-table">
          <thead><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Term</th><th>Score</th><th>Grade</th></tr></thead>
          <tbody>{(resRpt || []).map((r, i) => {
            const g = gradeOf(r.score);
            const gc = getGradeColor(g.c, isLight);
            return (<tr key={i}>
              <td style={{ fontWeight: 600, color: "var(--text-title)" }}>{r.student_name}</td>
              <td>{r.subject_name}</td><td>{r.exam_name}</td>
              <td><span className="badge badge-purple">{r.term}</span></td>
              <td style={{ fontWeight: 700, color: gc, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.score}/{r.total_marks}</td>
              <td><span className="badge" style={{ background: gc + "22", color: gc }}>{g.g}</span></td>
            </tr>);
          })}</tbody>
        </table>}
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────
function Usrs({ user, N, isLight }) {
  const [m, setM] = useState(null);
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const { data: userList, reload } = useData(() => API.users.list());
  const list = userList || [];

  const { data: loginHistory } = useData(() => API.users.logins(), []);
  const loginsList = loginHistory || [];

  const save = async () => {
    if (!f.name || !f.email || (m === "add" && !f.password)) { N("Fill required fields", false); return; }
    setSaving(true);
    try {
      if (m === "add") await API.users.create({ name: f.name, email: f.email, password: f.password, role: f.role || "Teacher", phone: f.phone });
      else await API.users.update(f.id, { name: f.name, email: f.email, role: f.role, phone: f.phone });
      N(m === "add" ? "User created" : "Updated"); setM(null); reload();
    } catch (e) { N(e.message, false); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this user?")) return;
    try { await API.users.delete(id); N("User removed"); reload(); }
    catch (e) { N(e.message, false); }
  };

  return (
    <div className="anim">
      <PH title="User Management" sub="System access and roles"
        btn={<button className="bp" onClick={() => { setF({ name: "", email: "", password: "", role: "Teacher", phone: "" }); setM("add"); }}>+ Add User</button>} />
      <div className="card"><table className="tbl">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>
          {list.map(u => (
            <tr key={u.id}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="av" style={{ background: getRoleColor(u.role, isLight) + "22", color: getRoleColor(u.role, isLight) }}>{u.avatar}</div>
                  <span style={{ fontWeight: 600, color: "var(--text-title)" }}>{u.name}</span>
                </div>
              </td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{u.email}</td>
              <td><span className="badge" style={{ background: getRoleColor(u.role, isLight) + "20", color: getRoleColor(u.role, isLight) }}>{u.role}</span></td>
              <td>{u.phone || "—"}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="be" onClick={() => { setF({ ...u }); setM("edit"); }}>Edit</button>
                  {u.id !== user.id && <button className="bd" onClick={() => del(u.id)}>Del</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div style={{ marginTop: 26 }} className="card">
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-title)", marginBottom: 16 }}>🔑 Recent Logged-in Sessions</div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>IP Address</th>
                <th>Device / Browser</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loginsList.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div className="av" style={{ background: getRoleColor(l.role, isLight) + "22", color: getRoleColor(l.role, isLight) }}>
                        {l.name ? l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "U"}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-title)" }}>{l.name || "Unknown User"}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{l.email}</td>
                  <td><span className="badge" style={{ background: getRoleColor(l.role, isLight) + "20", color: getRoleColor(l.role, isLight) }}>{l.role}</span></td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{l.ip_address}</td>
                  <td>{formatUserAgent(l.user_agent)}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                    {new Date(l.login_time).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
              {!loginsList.length && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-label)" }}>No login sessions recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(m === "add" || m === "edit") && (
        <Modal title={m === "add" ? "Add User" : "Edit User"} onClose={() => setM(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Fld label="Full Name"><input className="inp" value={f.name || ""} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Fld>
            <Fld label="Phone"><input className="inp" value={f.phone || ""} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} /></Fld>
            <Fld label="Email"><input className="inp" type="email" value={f.email || ""} onChange={e => setF(x => ({ ...x, email: e.target.value }))} /></Fld>
            {m === "add" && <Fld label="Password"><input className="inp" type="password" value={f.password || ""} onChange={e => setF(x => ({ ...x, password: e.target.value }))} /></Fld>}
            <Fld label="Role"><select className="inp" value={f.role || "Teacher"} onChange={e => setF(x => ({ ...x, role: e.target.value }))}>
              {["Admin", "Teacher", "Student", "Parent"].map(r => <option key={r}>{r}</option>)}
            </select></Fld>
          </div>
          <SaveCancel onSave={save} onCancel={() => setM(null)} label={m === "add" ? "Create User" : "Save Changes"} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
