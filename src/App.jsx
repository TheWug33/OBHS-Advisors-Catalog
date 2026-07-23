import { useState, useEffect, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Fallback URL — can also be set once via the site's settings menu (saved in browser)
const APPS_SCRIPT_URL_DEFAULT = "https://script.google.com/macros/s/AKfycby9pgOGITsZAr-6qqi9fp9vQQWnIapU23K_K7Uz220RF6lmfdbdNTPEyEN-3DA-TUjw/exec";
function getScriptUrl() {
  try {
    const saved = window.localStorage.getItem("obhs_script_url");
    if (saved && saved.startsWith("https://")) return saved;
  } catch {}
  return APPS_SCRIPT_URL_DEFAULT;
}

const SHEET_URLS = {
  9:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=0&single=true&output=csv",
  10: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=955151150&single=true&output=csv",
  11: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=1311311312&single=true&output=csv",
  12: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=449365991&single=true&output=csv",
  vendors: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=847121101&single=true&output=csv",
};

const SHEET_NAMES = { 9: "Freshmen", 10: "Sophomores", 11: "Juniors", 12: "Seniors", vendors: "Vendors" };

// Shared Google Calendar — advisors with edit access can add events directly;
// others can subscribe via the calendar's public iCal link from their own Apple/Outlook calendar.
const CALENDAR_ID = "5c02222fcf18436f487aec3892dd07593a31755a1e117357026a5471aba902d5@group.calendar.google.com";
const MONTHS = ["August","September","October","November","December","January","February","March","April","May","June","July"];

const GRADES = {
  9:  { label: "Grade 9",  color: "#e8e8ff", text: "#0e0c30" },
  10: { label: "Grade 10", color: "#b0b0b0", text: "#0e0c30", tabColor: "#a0a0a0" },
  11: { label: "Grade 11", color: "#c8c8c8", text: "#0e0c30", tabColor: "#909090" },
  12: { label: "Grade 12", color: "#a78bfa", text: "#0e0c30" },
};

const STATUS_CONFIG = {
  "Planning":  { color: "#f59e0b" },
  "Booked":    { color: "#3b82f6" },
  "Complete":  { color: "#10b981" },
};
const STATUSES = ["Planning", "Booked", "Complete"];
const VENDOR_CATEGORIES = ["DJ / Entertainment","Venue","Clothing / Printing","Catering / Food","Photography / Video","Supplies","Transportation","Other"];

const EMPTY_TASK   = { month: "August", title: "", description: "", leadtime: "", contacts: "", notes: "", fileurl: "", status: "Planning", editedby: "" };
const EMPTY_VENDOR = { name: "", category: "DJ / Entertainment", contact: "", phone: "", email: "", notes: "" };

// ─── HELPERS ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line, i) => {
    const cols = []; let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || "").replace(/^"|"$/g, "").trim(); });
    obj._row = i + 2;
    return obj;
  }).filter(r => r.title || r.month || r.name);
}

async function callScript(payload) {
  const url = getScriptUrl();
  if (url === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") throw new Error("Apps Script URL not set. Open the ⋯ menu → Settings to add it.");
  const res  = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "Script error");
  return json;
}

function printGrade(grade, tasks) {
  const g    = GRADES[grade];
  const list = tasks.slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const win  = window.open("", "_blank");
  const statusColors = { Planning: "#f59e0b", Booked: "#3b82f6", Complete: "#10b981" };
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OBHS ${g.label} Pacing Chart</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#12103a;color:#e0deee;padding:32px}
    h1{font-size:22px;font-weight:900;color:#fff;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px}
    .sub{font-size:11px;color:#7068a0;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px}
    .task{background:#1a1840;border:1px solid #252360;border-left:3px solid ${g.color};border-radius:8px;padding:16px 20px;margin-bottom:12px}
    .task-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
    .month{font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:3px 10px;border-radius:4px;background:rgba(255,255,255,0.08);color:${g.color}}
    .status{font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:20px}
    .title{font-size:15px;font-weight:700;color:#fff}
    .field{margin-top:8px;padding:8px 12px;border-radius:6px;border-left:3px solid}
    .field-label{font-size:8px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px}
    .field-val{font-size:13px;line-height:1.6;white-space:pre-wrap}
    .edited{font-size:10px;color:#5a5880;margin-top:8px}
    .footer{text-align:center;margin-top:40px;font-size:10px;color:#3a3860;letter-spacing:2px;text-transform:uppercase}
    @media print{body{background:#12103a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
  <h1>OBHS Knights — ${g.label}</h1>
  <p class="sub">Pacing Chart · Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>`);
  list.forEach(t => {
    const sc = statusColors[t.status] || "#7068a0";
    win.document.write(`<div class="task">
      <div class="task-top">
        <span class="month">${t.month}</span>
        ${t.status ? `<span class="status" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${t.status}</span>` : ""}
        <span class="title">${t.title}</span>
      </div>
      ${t.description ? `<div class="field" style="background:rgba(40,200,120,0.07);border-color:#28c878"><div class="field-label" style="color:#28c878">Description</div><div class="field-val" style="color:#80e8b0">${t.description}</div></div>` : ""}
      ${t.leadtime   ? `<div class="field" style="background:rgba(255,200,80,0.08);border-color:#c8a030"><div class="field-label" style="color:#c8a030">Lead Time</div><div class="field-val" style="color:#e8d080">${t.leadtime}</div></div>` : ""}
      ${t.contacts   ? `<div class="field" style="background:rgba(80,180,255,0.08);border-color:#4090c0"><div class="field-label" style="color:#60b0e0">Who to Contact</div><div class="field-val" style="color:#90c8f0">${t.contacts}</div></div>` : ""}
      ${t.notes      ? `<div class="field" style="background:rgba(155,109,255,0.1);border-color:#9b6dff"><div class="field-label" style="color:#9b6dff">Advisor Notes</div><div class="field-val" style="color:#c4a0ff">${t.notes}</div></div>` : ""}
      ${t.editedby   ? `<div class="edited">Last edited by ${t.editedby}</div>` : ""}
    </div>`);
  });
  win.document.write(`<div class="footer">Old Bridge High School · Class Advisor Pacing Chart</div></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ─── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState(9);
  const [data, setData]         = useState({ 9: [], 10: [], 11: [], 12: [], vendors: [] });
  const [loading, setLoading]   = useState({ 9: true, 10: true, 11: true, 12: true, vendors: true });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState(null);
  const [open, setOpen]         = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState("list"); // "list" | "timeline"
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl]   = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", date: "", startTime: "", endTime: "", description: "" });
  const [savingEvent, setSavingEvent] = useState(false);
  const fileInputRef = useRef(null);

  // Current month name for the TODAY marker
  const nowMonth = new Date().toLocaleString("en-US", { month: "long" });

  const isVendors  = tab === "vendors";
  const isCalendar = tab === "calendar";
  const grade      = (isVendors || isCalendar) ? null : tab;
  const g          = grade ? GRADES[grade] : null;
  const tabAcc     = g ? (g.tabColor || g.color) : isCalendar ? "#3b82f6" : "#e0a040";

  async function fetchTab(t) {
    setLoading(prev => ({ ...prev, [t]: true }));
    try {
      const url = SHEET_URLS[t];
      if (!url || url.includes("PASTE_")) { setData(prev => ({ ...prev, [t]: [] })); return; }
      const res  = await fetch(url + "&t=" + Date.now());
      const text = await res.text();
      setData(prev => ({ ...prev, [t]: parseCSV(text) }));
    } catch { setData(prev => ({ ...prev, [t]: [] })); }
    finally  { setLoading(prev => ({ ...prev, [t]: false })); }
  }

  useEffect(() => { [9,10,11,12,"vendors"].forEach(t => fetchTab(t)); }, []);

  function flash(type, text) { setSaveMsg({ type, text }); setTimeout(() => setSaveMsg(null), 3500); }

  // ── FILE UPLOAD ──
  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const base64 = ev.target.result.split(",")[1];
            const result = await callScript({ action: "uploadFile", fileName: file.name, mimeType: file.type, base64Data: base64 });
            setTaskForm(f => ({ ...f, fileurl: result.url }));
            flash("ok", `Uploaded: ${file.name}`);
            resolve();
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      });
    } catch (err) { flash("err", "Upload failed: " + err.message); }
    finally { setUploading(false); }
  }

  // ── TASK HANDLERS ──
  function startAddTask() { setEditing(null); setTaskForm(EMPTY_TASK); setShowForm(true); setOpen(null); }
  function startEditTask(t) {
    setEditing(t);
    setTaskForm({ month: t.month||"", title: t.title||"", description: t.description||"", leadtime: t.leadtime||"", contacts: t.contacts||"", notes: t.notes||"", fileurl: t.fileurl||"", status: t.status||"Planning", editedby: t.editedby||"" });
    setShowForm(true); setOpen(null);
  }
  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await callScript({ action: "update", sheet: SHEET_NAMES[grade], ...taskForm, originalTitle: editing.title, originalMonth: editing.month });
        setData(prev => ({ ...prev, [grade]: prev[grade].map(t => t.title === editing.title && t.month === editing.month ? { ...t, ...taskForm } : t) }));
      } else {
        await callScript({ action: "add", sheet: SHEET_NAMES[grade], ...taskForm });
        setData(prev => ({ ...prev, [grade]: [...prev[grade], { ...taskForm, _row: prev[grade].length + 2 }] }));
      }
      setShowForm(false); setEditing(null); flash("ok", "Saved!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }
  async function handleDeleteTask(task) {
    setSaving(true); setConfirmDelete(null);
    try {
      await callScript({ action: "delete", sheet: SHEET_NAMES[grade], originalTitle: task.title, originalMonth: task.month });
      setData(prev => ({ ...prev, [grade]: prev[grade].filter(t => !(t.title === task.title && t.month === task.month)) }));
      setOpen(null); flash("ok", "Removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  // ── VENDOR HANDLERS ──
  function startAddVendor() { setEditing(null); setVendorForm(EMPTY_VENDOR); setShowForm(true); setOpen(null); }
  function startEditVendor(v) {
    setEditing(v);
    setVendorForm({ name: v.name||"", category: v.category||"DJ / Entertainment", contact: v.contact||"", phone: v.phone||"", email: v.email||"", notes: v.notes||"" });
    setShowForm(true); setOpen(null);
  }
  async function handleSaveVendor() {
    if (!vendorForm.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await callScript({ action: "updateVendor", sheet: "Vendors", ...vendorForm, originalName: editing.name });
        setData(prev => ({ ...prev, vendors: prev.vendors.map(v => v.name === editing.name ? { ...v, ...vendorForm } : v) }));
      } else {
        await callScript({ action: "addVendor", sheet: "Vendors", ...vendorForm });
        setData(prev => ({ ...prev, vendors: [...prev.vendors, { ...vendorForm, _row: prev.vendors.length + 2 }] }));
      }
      setShowForm(false); setEditing(null); flash("ok", "Vendor saved!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }
  async function handleDeleteVendor(v) {
    setSaving(true); setConfirmDelete(null);
    try {
      await callScript({ action: "deleteVendor", sheet: "Vendors", originalName: v.name });
      setData(prev => ({ ...prev, vendors: prev.vendors.filter(x => x.name !== v.name) }));
      setOpen(null); flash("ok", "Removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  async function handleAddEvent() {
    if (!eventForm.title.trim() || !eventForm.date) return;
    setSavingEvent(true);
    try {
      await callScript({
        action: "addCalendarEvent",
        title: eventForm.title,
        date: eventForm.date,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        description: eventForm.description,
      });
      flash("ok", "Event added to calendar!");
      setEventForm({ title: "", date: "", startTime: "", endTime: "", description: "" });
      setShowEventForm(false);
    } catch (e) {
      flash("err", e.message);
    } finally {
      setSavingEvent(false);
    }
  }

  const searchLower = search.trim().toLowerCase();
  const taskList = (data[grade] || [])
    .filter(t => !searchLower || [t.title, t.description, t.notes, t.contacts, t.leadtime].some(f => (f||"").toLowerCase().includes(searchLower)))
    .slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const vendorList = (data.vendors || [])
    .filter(v => !searchLower || [v.name, v.category, v.contact, v.notes].some(f => (f||"").toLowerCase().includes(searchLower)))
    .slice().sort((a,b) => (a.name||"").localeCompare(b.name||""));
  const isLoading = loading[tab];

  // Status counts for the at-a-glance strip
  const statusCounts = { Planning: 0, Booked: 0, Complete: 0 };
  (data[grade] || []).forEach(t => { if (statusCounts[t.status] !== undefined) statusCounts[t.status]++; });

  return (
    <div style={{ background: "#0a0818", minHeight: "100vh", width: "100%", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100%; background: #0a0818; overscroll-behavior-y: none; }
        body { overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        button { touch-action: manipulation; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a2560; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
        .card-hover:hover { border-color: #2e2a6a !important; }
        .card-hover:active { transform: scale(0.99); transition: transform 0.08s; }
        .btn-p { transition: opacity 0.15s, transform 0.1s; }
        .btn-p:hover { opacity: 0.88; }
        .btn-p:active { transform: scale(0.96); }
        .tab-press { transition: transform 0.1s; }
        .tab-press:active { transform: scale(0.9); }
        .tabscroll::-webkit-scrollbar { display: none; }
        .tabscroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        background: "rgba(10,8,24,0.95)", borderBottom: "1px solid #1a1640",
        padding: "calc(env(safe-area-inset-top, 0px) + 10px) 20px 10px",
        display: "flex", alignItems: "center", gap: 10,
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)"
      }}>
        <button
          onClick={() => { setTab(9); setOpen(null); setShowForm(false); setSearch(""); }}
          className="tab-press"
          style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          title="Back to Grade 9 home"
        >
          <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 10px ${tabAcc}25` }}>
            <img src="/icon-192.png" alt="OBHS" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5 }}>OBHS</div>
        </button>
        <div style={{ flex: 1 }} />

        {/* Overflow menu */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #1a1640", borderRadius: 8, color: "#8080b0", cursor: "pointer", fontSize: 18 }}>⋯</button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
              <div style={{ position: "absolute", right: 0, top: 42, background: "#100e28", border: "1px solid #2a2560", borderRadius: 10, padding: 6, minWidth: 160, zIndex: 95, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", animation: "fadeIn 0.15s ease" }}>
                {!isVendors && (
                  <button onClick={() => { printGrade(grade, data[grade] || []); setMenuOpen(false); }}
                    style={MENU_ITEM}>⎙ Print Pacing Chart</button>
                )}
                <button onClick={() => { [9,10,11,12,"vendors"].forEach(t => fetchTab(t)); setOpen(null); setMenuOpen(false); }}
                  style={MENU_ITEM}>↻ Refresh Data</button>
                <button onClick={() => { setSettingsUrl(getScriptUrl() === "PASTE_YOUR_APPS_SCRIPT_URL_HERE" ? "" : getScriptUrl()); setShowSettings(true); setMenuOpen(false); }}
                  style={MENU_ITEM}>⚙ Settings</button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ── TOAST ── */}
      {saveMsg && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", animation: "fadeIn 0.2s ease",
          background: saveMsg.type === "ok" ? "#0d2a1a" : "#2a0d0d",
          border: `1px solid ${saveMsg.type === "ok" ? "#10b981" : "#ef4444"}44`,
          color: saveMsg.type === "ok" ? "#10b981" : "#ef4444",
          padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {saveMsg.type === "ok" ? "✓ " : "✕ "}{saveMsg.text}
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#100e28", border: "1px solid #2a2560", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "fadeIn 0.2s ease" }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 6px" }}>⚙ Settings</p>
            <p style={{ color: "#6060a0", fontSize: 12, margin: "0 0 18px", lineHeight: 1.6 }}>
              Paste your Google Apps Script Web App URL here. It's saved in this browser and survives site updates.
            </p>
            <div style={LL}>Apps Script URL</div>
            <input value={settingsUrl} onChange={e => setSettingsUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              style={{ ...FF, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => {
                  try { window.localStorage.setItem("obhs_script_url", settingsUrl.trim()); } catch {}
                  setShowSettings(false);
                  flash("ok", "Settings saved!");
                }}
                disabled={!settingsUrl.trim().startsWith("https://")}
                style={{ flex: 1, padding: "11px", background: settingsUrl.trim().startsWith("https://") ? "#a78bfa" : "#1a1840", color: settingsUrl.trim().startsWith("https://") ? "#0e0c30" : "#4a4870", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Save
              </button>
              <button onClick={() => setShowSettings(false)}
                style={{ flex: 1, padding: "11px", background: "transparent", color: "#6060a0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#100e28", border: "1px solid #2a2560", borderRadius: 16, padding: 28, maxWidth: 360, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "fadeIn 0.2s ease" }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 8px" }}>Remove {isVendors ? "vendor" : "task"}?</p>
            <p style={{ color: "#6060a0", fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>
              <span style={{ color: "#a0a0e0" }}>{confirmDelete.title || confirmDelete.name}</span> will be permanently deleted from the sheet. This cannot be undone.
            </p>
            {(confirmDelete.description || confirmDelete.notes) && (
              <div style={{ background: "#0a0818", border: "1px solid #1a1640", borderRadius: 8, padding: "10px 12px", marginBottom: 20, maxHeight: 100, overflowY: "auto" }}>
                <span style={{ display: "block", fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#ef4444", marginBottom: 4 }}>⚠ This will be lost</span>
                {confirmDelete.description && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#8080a0", lineHeight: 1.5 }}>{confirmDelete.description}</p>}
                {confirmDelete.notes && <p style={{ margin: 0, fontSize: 11, color: "#8080a0", lineHeight: 1.5, fontStyle: "italic" }}>{confirmDelete.notes}</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => isVendors ? handleDeleteVendor(confirmDelete) : handleDeleteTask(confirmDelete)}
                style={{ flex: 1, padding: "11px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "11px", background: "transparent", color: "#6060a0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px 110px" }}>

        {/* Search + View Toggle + Add button row */}
        {!showForm && !isCalendar && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ flex: "1 1 160px", position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3a3870", fontSize: 13, pointerEvents: "none" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isVendors ? "Search vendors..." : "Search tasks..."}
                style={{ width: "100%", padding: "8px 12px 8px 32px", background: "#0d0b20", color: "#c0c0e0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#3a3870", cursor: "pointer", fontSize: 14 }}>✕</button>
              )}
            </div>

            {/* View toggle (tasks only) */}
            {!isVendors && (
              <div style={{ display: "flex", background: "#0d0b20", border: "1px solid #1a1640", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {[["list","☰"],["timeline","▤"]].map(([val, icon]) => (
                  <button key={val} onClick={() => setView(val)} title={val === "list" ? "List view" : "Timeline view"}
                    style={{ padding: "8px 12px", background: view === val ? tabAcc+"20" : "transparent",
                      border: "none", color: view === val ? tabAcc : "#3a3860", fontSize: 14, cursor: "pointer" }}>
                    {icon}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => isVendors ? startAddVendor() : startAddTask()} className="btn-p"
              style={{ padding: "8px 18px", borderRadius: 8, background: isVendors ? "#e0a040" : tabAcc,
                color: isVendors ? "#0e0c30" : (g?.text || "#fff"),
                border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                boxShadow: `0 4px 12px ${isVendors ? "#e0a04040" : tabAcc+"40"}` }}>
              + {isVendors ? "Vendor" : "Task"}
            </button>
          </div>
        )}

        {/* ── AT-A-GLANCE STATUS STRIP ── */}
        {!showForm && !isVendors && !isLoading && (data[grade] || []).length > 0 && (
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, paddingLeft: 2 }}>
            {STATUSES.map(s => {
              const sc = STATUS_CONFIG[s];
              return (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5a5890" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color, boxShadow: `0 0 5px ${sc.color}60` }} />
                  {statusCounts[s]} {s}
                </span>
              );
            })}
          </div>
        )}

        {/* ── TASK FORM ── */}
        {showForm && !isVendors && (
          <div style={{ background: "#100e28", border: `1px solid ${tabAcc}55`, borderRadius: 14, padding: 22, marginBottom: 16, boxShadow: `0 8px 32px rgba(0,0,0,0.4)`, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 4, height: 20, background: tabAcc, borderRadius: 2 }} />
              <p style={{ margin: 0, color: tabAcc, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>{editing ? "Edit Task" : "New Task"} — {g.label}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 130px" }}>
                  <div style={LL}>Month</div>
                  <select value={taskForm.month} onChange={e => setTaskForm(f => ({ ...f, month: e.target.value }))} style={FF}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select>
                </div>
                <div style={{ flex: "1 1 130px" }}>
                  <div style={LL}>Status</div>
                  <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} style={FF}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                </div>
              </div>
              <div>
                <div style={LL}>Title *</div>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task name" style={FF} />
                {!editing && (
                  <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "#4a4880", lineHeight: 1.5 }}>
                    💡 Tip: set <strong style={{ color: "#6060a0" }}>Month</strong> to when planning should <em>start</em>, not when the event happens. If Senior Prom needs a venue booked a year out, put that task on this grade's chart even if the event itself is later.
                  </p>
                )}
              </div>
              <div>
                <div style={LL}>Description</div>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="What's involved, key steps..." style={{ ...FF, resize: "vertical" }} />
              </div>
              <div>
                <div style={LL}>⏱ Lead Time</div>
                <input value={taskForm.leadtime} onChange={e => setTaskForm(f => ({ ...f, leadtime: e.target.value }))} placeholder="e.g. Book 6 months ahead" style={FF} />
              </div>
              <div>
                <div style={LL}>📋 Who to Contact</div>
                <input value={taskForm.contacts} onChange={e => setTaskForm(f => ({ ...f, contacts: e.target.value }))} placeholder="e.g. Mrs. Smith, ext. 204" style={FF} />
              </div>
              <div>
                <div style={LL}>★ Advisor Notes</div>
                <textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Tips, budget, lessons learned..." style={{ ...FF, resize: "vertical" }} />
              </div>
              <div>
                <div style={LL}>✍ Last Edited By</div>
                <input value={taskForm.editedby} onChange={e => setTaskForm(f => ({ ...f, editedby: e.target.value }))} placeholder="Your name" style={FF} />
              </div>
              <div>
                <div style={LL}>📎 Attach File</div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx" style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => fileInputRef.current.click()} disabled={uploading}
                    style={{ padding: "8px 16px", background: "transparent", color: "#6060a0", border: "1px solid #1a1640", borderRadius: 6, fontSize: 12, cursor: uploading ? "wait" : "pointer" }}>
                    {uploading ? "⏳ Uploading…" : "Choose File"}
                  </button>
                  {taskForm.fileurl && <>
                    <a href={taskForm.fileurl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#60b0e0", textDecoration: "none", fontWeight: 600 }}>📄 View</a>
                    <button type="button" onClick={() => setTaskForm(f => ({ ...f, fileurl: "" }))} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleSaveTask} disabled={saving || !taskForm.title.trim()} className="btn-p"
                style={{ padding: "10px 22px", background: saving ? "#1a1840" : tabAcc, color: saving ? "#4a4870" : (g?.text || "#fff"), border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Task"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 16px", background: "transparent", color: "#4a4870", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── VENDOR FORM ── */}
        {showForm && isVendors && (
          <div style={{ background: "#100e28", border: "1px solid #e0a04055", borderRadius: 14, padding: 22, marginBottom: 16, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 4, height: 20, background: "#e0a040", borderRadius: 2 }} />
              <p style={{ margin: 0, color: "#e0a040", fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>{editing ? "Edit Vendor" : "New Vendor"}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={LL}>Vendor Name *</div>
                <input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sound Wave DJ" style={FF} />
              </div>
              <div>
                <div style={LL}>Category</div>
                <select value={vendorForm.category} onChange={e => setVendorForm(f => ({ ...f, category: e.target.value }))} style={FF}>{VENDOR_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <div style={LL}>Contact Person</div>
                <input value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} placeholder="Name" style={FF} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 140px" }}>
                  <div style={LL}>Phone</div>
                  <input value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} placeholder="732-555-0100" style={FF} />
                </div>
                <div style={{ flex: "1 1 180px" }}>
                  <div style={LL}>Email</div>
                  <input value={vendorForm.email} onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" style={FF} />
                </div>
              </div>
              <div>
                <div style={LL}>Notes</div>
                <textarea value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Pricing, experience, recommendations..." style={{ ...FF, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleSaveVendor} disabled={saving || !vendorForm.name.trim()} className="btn-p"
                style={{ padding: "10px 22px", background: saving ? "#1a1840" : "#e0a040", color: saving ? "#4a4870" : "#0e0c30", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Vendor"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 16px", background: "transparent", color: "#4a4870", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ display: "inline-block", width: 30, height: 30, border: "2px solid #1a1640", borderTop: `2px solid ${tabAcc}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {/* ── TASK CARDS ── */}
        {!isLoading && !isVendors && !isCalendar && taskList.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#2a2860" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
            <p style={{ fontSize: 14 }}>No tasks yet. Add one to get started.</p>
          </div>
        )}

        {!isLoading && !isVendors && !isCalendar && view === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {MONTHS.map(m => {
              const monthTasks = taskList.filter(t => t.month === m);
              if (monthTasks.length === 0) return null;
              return (
                <div key={m}>
                  {/* Month header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingLeft: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: tabAcc }}>{m}</span>
                    {m === nowMonth && (
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#10b981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 20, padding: "2px 8px", boxShadow: "0 0 10px rgba(16,185,129,0.25)" }}>● Today</span>
                    )}
                    <div style={{ flex: 1, height: 1, background: `${tabAcc}20` }} />
                    <span style={{ fontSize: 10, color: "#3a3860", fontWeight: 600 }}>{monthTasks.length}</span>
                  </div>
                  {/* Events in this month */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {monthTasks.map(task => {
                      const key = `${grade}_${task.title}_${task.month}`;
                      const sc  = STATUS_CONFIG[task.status];
                      const hasDetail = task.description || task.leadtime || task.contacts || task.notes || task.fileurl;
                      const isOpen = open === key;
                      return (
                        <div key={key} className="card-hover" style={{ background: "#0d0b20", borderRadius: 10, border: `1px solid ${isOpen ? "#2a2560" : "#16143a"}`, borderLeft: `3px solid ${tabAcc}`, overflow: "hidden", transition: "all 0.15s" }}>
                          <div onClick={() => setOpen(isOpen ? null : key)} style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 11 }}>
                            {/* Status dot */}
                            <div title={task.status} style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: sc ? sc.color : "#3a3860", boxShadow: sc ? `0 0 6px ${sc.color}80` : "none" }} />
                            {/* Title */}
                            <span style={{ flex: 1, color: "#e0deee", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                            {task.status && <span style={{ fontSize: 9, color: sc?.color || "#3a3860", fontWeight: 700 }}>{task.status}</span>}
                            <span style={{ color: "#2a2860", fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                          </div>

                          {isOpen && (
                            <div style={{ borderTop: "1px solid #16143a", padding: "16px", background: "#0a0818", animation: "fadeIn 0.15s ease" }}>
                              {task.description && <CALLOUT color="#10b981" label="Description" value={task.description} />}
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {task.leadtime && <CALLOUT color="#f59e0b" label="Lead Time" value={task.leadtime} flex />}
                                {task.contacts && <CALLOUT color="#3b82f6" label="Who to Contact" value={task.contacts} flex />}
                              </div>
                              {task.notes && <CALLOUT color="#a78bfa" label="Advisor Notes" value={task.notes} />}
                              {task.fileurl && (
                                <div style={{ background: "rgba(240,128,96,0.08)", border: "1px solid rgba(240,128,96,0.25)", borderLeft: "3px solid #f08060", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                                  <span style={{ display: "block", fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#f08060", marginBottom: 6 }}>Attached File</span>
                                  <a href={task.fileurl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#f0a080", textDecoration: "none", fontWeight: 600 }}>Open Document →</a>
                                </div>
                              )}
                              {!hasDetail && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#2a2860", fontStyle: "italic" }}>No details yet — tap Edit to add.</p>}
                              {task.editedby && <p style={{ margin: "0 0 14px", fontSize: 10, color: "#3a3860" }}>✍ Last edited by <span style={{ color: "#6060a0" }}>{task.editedby}</span></p>}
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => startEditTask(task)} style={{ padding: "6px 16px", background: `${tabAcc}18`, color: tabAcc, border: `1px solid ${tabAcc}40`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                                <button onClick={() => setConfirmDelete(task)} style={{ padding: "6px 14px", background: "transparent", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Remove</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TIMELINE VIEW ── */}
        {!isLoading && !isVendors && !isCalendar && view === "timeline" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MONTHS.map(m => {
              const monthTasks = taskList.filter(t => t.month === m);
              if (monthTasks.length === 0) return null;
              return (
                <div key={m} style={{ display: "flex", gap: 12 }}>
                  {/* Month label column */}
                  <div style={{ flex: "0 0 68px", textAlign: "right", paddingTop: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: tabAcc }}>{m.slice(0,3)}</span>
                  </div>
                  {/* Timeline track */}
                  <div style={{ position: "relative", flex: 1, borderLeft: `2px solid ${tabAcc}30`, paddingLeft: 16, paddingBottom: 16 }}>
                    {monthTasks.map((task, i) => {
                      const key = `${grade}_${task.title}_${task.month}`;
                      const sc  = STATUS_CONFIG[task.status];
                      const isOpen = open === key;
                      return (
                        <div key={key} style={{ position: "relative", marginBottom: i === monthTasks.length - 1 ? 0 : 8 }}>
                          {/* dot on the line */}
                          <div style={{ position: "absolute", left: -21, top: 16, width: 9, height: 9, borderRadius: "50%", background: sc ? sc.color : tabAcc, border: "2px solid #0a0818", boxShadow: sc ? `0 0 6px ${sc.color}` : "none" }} />
                          <div className="card-hover" onClick={() => setOpen(isOpen ? null : key)}
                            style={{ background: "#0d0b20", border: `1px solid ${isOpen ? "#2a2560" : "#16143a"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ flex: 1, color: "#e0deee", fontSize: 13, fontWeight: 600 }}>{task.title}</span>
                              {task.status && <span style={{ fontSize: 9, color: sc?.color || "#3a3860", fontWeight: 700 }}>{task.status}</span>}
                            </div>
                            {isOpen && (
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #16143a" }}>
                                {task.description && <CALLOUT color="#10b981" label="Description" value={task.description} />}
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  {task.leadtime && <CALLOUT color="#f59e0b" label="Lead Time" value={task.leadtime} flex />}
                                  {task.contacts && <CALLOUT color="#3b82f6" label="Who to Contact" value={task.contacts} flex />}
                                </div>
                                {task.notes && <CALLOUT color="#a78bfa" label="Advisor Notes" value={task.notes} />}
                                {task.fileurl && <a href={task.fileurl} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 12, color: "#f0a080", marginBottom: 10, textDecoration: "none", fontWeight: 600 }}>📎 Open Document →</a>}
                                <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => startEditTask(task)} style={{ padding: "5px 14px", background: `${tabAcc}18`, color: tabAcc, border: `1px solid ${tabAcc}40`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                                  <button onClick={() => setConfirmDelete(task)} style={{ padding: "5px 12px", background: "transparent", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 6, fontSize: 10, cursor: "pointer" }}>Remove</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {taskList.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 0", color: "#2a2860" }}>
                <p style={{ fontSize: 14 }}>No tasks match your view.</p>
              </div>
            )}
          </div>
        )}

        {/* ── VENDOR CARDS ── */}
        {!isLoading && isVendors && vendorList.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#2a2860" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🏪</div>
            <p style={{ fontSize: 14 }}>No vendors yet. Add one to get started.</p>
          </div>
        )}

        {!isLoading && isVendors && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {vendorList.map(v => {
              const key = `vendor_${v.name}`;
              const isOpen = open === key;
              return (
                <div key={key} className="card-hover" style={{ background: "#0d0b20", borderRadius: 10, border: `1px solid ${isOpen ? "#2a2560" : "#16143a"}`, borderLeft: "3px solid #e0a040", overflow: "hidden" }}>
                  <div onClick={() => setOpen(isOpen ? null : key)} style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 11 }}>
                    <span style={{ background: "rgba(224,160,64,0.12)", color: "#e0a040", borderRadius: 6, padding: "3px 9px", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid rgba(224,160,64,0.25)" }}>{v.category || "Other"}</span>
                    <span style={{ flex: 1, color: "#e0deee", fontSize: 14, fontWeight: 600 }}>{v.name}</span>
                    <span style={{ color: "#2a2860", fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #16143a", padding: "16px", background: "#0a0818", animation: "fadeIn 0.15s ease" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: v.notes ? 12 : 0 }}>
                        {v.contact && <CALLOUT color="#3b82f6" label="Contact" value={v.contact} flex />}
                        {v.phone   && <CALLOUT color="#10b981" label="Phone" value={<a href={`tel:${v.phone}`} style={{ color: "#6ee7b7", textDecoration: "none" }}>{v.phone}</a>} flex />}
                        {v.email   && <CALLOUT color="#a78bfa" label="Email" value={<a href={`mailto:${v.email}`} style={{ color: "#c4b5fd", textDecoration: "none" }}>{v.email}</a>} flex />}
                      </div>
                      {v.notes && <CALLOUT color="#f59e0b" label="Notes" value={v.notes} />}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button onClick={() => startEditVendor(v)} style={{ padding: "6px 16px", background: "rgba(224,160,64,0.1)", color: "#e0a040", border: "1px solid rgba(224,160,64,0.3)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => setConfirmDelete(v)} style={{ padding: "6px 14px", background: "transparent", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CALENDAR VIEW ── */}
        {isCalendar && (
          <div>
            <div style={{ background: "#0d0b20", border: "1px solid #1a1640", borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <p style={{ margin: 0, color: "#e0deee", fontSize: 14, fontWeight: 700 }}>📅 Advisor Calendar</p>
                <button onClick={() => setShowEventForm(s => !s)} className="btn-p"
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#3b82f6", color: "#fff",
                    border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {showEventForm ? "Cancel" : "+ Event"}
                </button>
              </div>

              {showEventForm && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a1640", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={LL}>Event Title *</div>
                    <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Homecoming Committee Meeting" style={FF} />
                  </div>
                  <div>
                    <div style={LL}>Date *</div>
                    <input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} style={FF} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={LL}>Start Time</div>
                      <input type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} style={FF} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={LL}>End Time</div>
                      <input type="time" value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} style={FF} />
                    </div>
                  </div>
                  <div>
                    <div style={LL}>Description</div>
                    <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Optional details..." style={{ ...FF, resize: "vertical" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 10.5, color: "#4a4880" }}>
                    Leave both times blank for an all-day event.
                  </p>
                  <button onClick={handleAddEvent} disabled={savingEvent || !eventForm.title.trim() || !eventForm.date} className="btn-p"
                    style={{ padding: "10px 20px", background: savingEvent ? "#1a1840" : "#3b82f6", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: savingEvent ? "wait" : "pointer" }}>
                    {savingEvent ? "Adding…" : "Add to Calendar"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <a href={`https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(CALENDAR_ID)}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10.5, fontWeight: 600, color: "#6d9fdb", background: "transparent", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 6, padding: "6px 12px", textDecoration: "none" }}>
                  Open in Google Calendar
                </a>
                <a href={`webcal://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`}
                  style={{ fontSize: 10.5, fontWeight: 600, color: "#9c85d6", background: "transparent", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 6, padding: "6px 12px", textDecoration: "none" }}>
                  Subscribe
                </a>
              </div>
            </div>

            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #1a1640", background: "#0d0b20" }}>
              <iframe
                title="OBHS Advisor Calendar"
                src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDAR_ID)}&ctz=America%2FNew_York&mode=MONTH&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&bgcolor=%230a0818&color=%23a78bfa`}
                style={{ width: "100%", height: 600, border: "none", display: "block" }}
                frameBorder="0"
                scrolling="no"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM TAB BAR (native app style) ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(13,11,32,0.92)",
        borderTop: "1px solid #1a1640",
        backdropFilter: "blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 80,
      }}>
        <div style={{ display: "flex", maxWidth: 800, margin: "0 auto" }}>
          {[
            { key: 9,  icon: "①", label: "Gr 9" },
            { key: 10, icon: "②", label: "Gr 10" },
            { key: 11, icon: "③", label: "Gr 11" },
            { key: 12, icon: "④", label: "Gr 12" },
            { key: "vendors", icon: "🏪", label: "Vendors" },
            { key: "calendar", icon: "📅", label: "Calendar" },
          ].map(item => {
            const active = tab === item.key;
            const gc = (item.key !== "vendors" && item.key !== "calendar") ? GRADES[item.key] : null;
            const tc = active ? (gc ? (gc.tabColor || gc.color) : item.key === "calendar" ? "#3b82f6" : "#e0a040") : "#3a3860";
            return (
              <button key={item.key}
                className="tab-press"
                onClick={() => { setTab(item.key); setOpen(null); setShowForm(false); }}
                style={{
                  flex: 1, background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "9px 1px 8px", color: tc, transition: "color 0.15s", minWidth: 0,
                }}>
                <span style={{ fontSize: 15, lineHeight: 1, opacity: active ? 1 : 0.55, transform: active ? "scale(1.1)" : "scale(1)", transition: "all 0.15s" }}>{item.icon}</span>
                <span style={{ fontSize: 8.5, fontWeight: active ? 800 : 500, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{item.label}</span>
                {active && <span style={{ width: 4, height: 4, borderRadius: "50%", background: tc, marginTop: 1, boxShadow: `0 0 6px ${tc}` }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CALLOUT({ color, label, value, flex }) {
  return (
    <div style={{ ...(flex ? { flex: 1, minWidth: 140 } : {}), background: `${color}12`, border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color, marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 13, color: `${color}cc`, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</span>
    </div>
  );
}

const FF = { width: "100%", padding: "9px 12px", background: "#080618", color: "#c0c0e0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const LL = { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#3a3870", marginBottom: 6 };
const MENU_ITEM = { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "transparent", border: "none", color: "#a0a0e0", fontSize: 13, cursor: "pointer", borderRadius: 6, fontFamily: "inherit" };
