import { useState, useEffect, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

const SHEET_URLS = {
  9:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=0&single=true&output=csv",
  10: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=955151150&single=true&output=csv",
  11: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=1311311312&single=true&output=csv",
  12: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=449365991&single=true&output=csv",
  vendors: "PASTE_VENDORS_SHEET_CSV_URL_HERE",
};

const SHEET_NAMES = { 9: "Freshmen", 10: "Sophomores", 11: "Juniors", 12: "Seniors", vendors: "Vendors" };
const MONTHS = ["August","September","October","November","December","January","February","March","April","May","June","July"];

const GRADES = {
  9:  { label: "Freshmen",   color: "#e8e8ff", text: "#0e0c30", pill: "rgba(232,232,255,0.12)", dim: "#8080b0" },
  10: { label: "Sophomores", color: "#b0b0b0", text: "#0e0c30", pill: "rgba(176,176,176,0.12)", dim: "#707070", tabColor: "#a0a0a0" },
  11: { label: "Juniors",    color: "#c8c8c8", text: "#0e0c30", pill: "rgba(80,80,80,0.35)",    dim: "#909090", tabColor: "#909090" },
  12: { label: "Seniors",    color: "#a78bfa", text: "#0e0c30", pill: "rgba(167,139,250,0.15)", dim: "#7c5fc0" },
};

const STATUS_CONFIG = {
  "Planning":  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  "Booked":    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  "Complete":  { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
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
  if (APPS_SCRIPT_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") throw new Error("Apps Script URL not configured yet.");
  const res  = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "Script error");
  return json;
}

function daysUntil(monthName) {
  const idx   = MONTHS.indexOf(monthName);
  if (idx < 0) return null;
  const now   = new Date();
  const year  = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const schYear = idx >= 0 && idx <= 4 ? year : year + 1; // Aug-Dec = this year, Jan-Jul = next
  const target  = new Date(schYear, [7,8,9,10,11,0,1,2,3,4,5,6][idx], 1);
  const diff    = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function printGrade(grade, tasks) {
  const g    = GRADES[grade];
  const list = tasks.slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const win  = window.open("", "_blank");
  const statusColors = { Planning: "#f59e0b", Booked: "#3b82f6", Complete: "#10b981" };
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>OBHS ${g.label} Pacing Chart</title>
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
  win.document.write(`<div class="footer">Old Bridge High School · Class Advisor Pacing Chart · Confidential</div></body></html>`);
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
  const [filter, setFilter]     = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCat, setFilterCat]       = useState("All");
  const [sortBy, setSortBy]     = useState("month"); // "month" | "status"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fileInputRef = useRef(null);

  const isVendors = tab === "vendors";
  const grade     = isVendors ? null : tab;
  const g         = grade ? GRADES[grade] : null;
  const tabAcc    = g ? (g.tabColor || g.color) : "#e0a040";

  async function fetchTab(t) {
    setLoading(prev => ({ ...prev, [t]: true }));
    try {
      const url = SHEET_URLS[t];
      if (!url || url.includes("PASTE_")) { setData(prev => ({ ...prev, [t]: [] })); return; }
      const res  = await fetch(url + "&t=" + Date.now());
      const text = await res.text();
      setData(prev => ({ ...prev, [t]: parseCSV(text) }));
      if (t === 9) setLastUpdated(new Date());
    } catch { setData(prev => ({ ...prev, [t]: [] })); }
    finally  { setLoading(prev => ({ ...prev, [t]: false })); }
  }

  useEffect(() => { [9,10,11,12,"vendors"].forEach(t => fetchTab(t)); }, []);

  function flash(type, text) {
    setSaveMsg({ type, text });
    setTimeout(() => setSaveMsg(null), 3500);
  }

  // ── FILE UPLOAD ──────────────────────────────────────────────────────────
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
    } catch (err) {
      flash("err", "Upload failed: " + err.message);
    } finally { setUploading(false); }
  }

  // ── TASK HANDLERS ────────────────────────────────────────────────────────
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
      setOpen(null); flash("ok", "Task removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  // ── VENDOR HANDLERS ──────────────────────────────────────────────────────
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
      setOpen(null); flash("ok", "Vendor removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  // ── DERIVED LISTS ────────────────────────────────────────────────────────
  const allTasks = data[grade] || [];
  const taskList = allTasks
    .filter(t => (filter === "All" || t.month === filter) && (filterStatus === "All" || t.status === filterStatus))
    .sort((a, b) => sortBy === "status"
      ? STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
      : MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

  const vendorList = (data.vendors || [])
    .filter(v => filterCat === "All" || v.category === filterCat)
    .sort((a,b) => (a.name||"").localeCompare(b.name||""));

  const usedMonths  = [...new Set(allTasks.map(t => t.month))];
  const usedCats    = [...new Set((data.vendors||[]).map(v => v.category).filter(Boolean))];
  const isLoading   = loading[tab];

  // status counts for the grade overview
  const counts = { Planning: 0, Booked: 0, Complete: 0 };
  allTasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  return (
    <div style={{ background: "#0a0818", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0818; }
        ::-webkit-scrollbar-thumb { background: #2a2560; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .card-hover:hover { border-color: #2e2a6a !important; transform: translateY(-1px); transition: all 0.15s; }
        .btn-primary { transition: opacity 0.15s, transform 0.1s; }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ background: "rgba(10,8,24,0.95)", borderBottom: "1px solid #1a1640", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${tabAcc}33, ${tabAcc}11)`, border: `1px solid ${tabAcc}44`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: tabAcc, boxShadow: `0 0 8px ${tabAcc}` }} />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" }}>OBHS</div>
          <div style={{ color: "#4a4870", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginTop: -2 }}>Advisor Catalog</div>
        </div>
        <div style={{ flex: 1 }} />
        {!isVendors && grade && (
          <button onClick={() => printGrade(grade, allTasks)} className="btn-primary"
            style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${tabAcc}44`, color: tabAcc, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
            ⎙ Print
          </button>
        )}
        <button onClick={() => { setOpen(null); [9,10,11,12,"vendors"].forEach(t => fetchTab(t)); }} title="Refresh"
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #1a1640", borderRadius: 6, color: "#4a4870", cursor: "pointer", fontSize: 16 }}>↻</button>
      </nav>

      {/* ── TOAST ── */}
      {saveMsg && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", animation: "fadeIn 0.2s ease",
          background: saveMsg.type === "ok" ? "#0d2a1a" : "#2a0d0d",
          border: `1px solid ${saveMsg.type === "ok" ? "#10b981" : "#ef4444"}44`,
          color: saveMsg.type === "ok" ? "#10b981" : "#ef4444",
          padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {saveMsg.type === "ok" ? "✓ " : "✕ "}{saveMsg.text}
        </div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#100e28", border: "1px solid #2a2560", borderRadius: 16, padding: 28, maxWidth: 340, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", animation: "fadeIn 0.2s ease" }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 8px" }}>Remove {isVendors ? "vendor" : "task"}?</p>
            <p style={{ color: "#6060a0", fontSize: 13, margin: "0 0 24px", lineHeight: 1.6 }}>
              <span style={{ color: "#a0a0e0" }}>{confirmDelete.title || confirmDelete.name}</span> will be permanently deleted from the sheet.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => isVendors ? handleDeleteVendor(confirmDelete) : handleDeleteTask(confirmDelete)}
                style={{ flex: 1, padding: "11px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "11px", background: "transparent", color: "#6060a0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GRADE TABS ── */}
      <div style={{ background: "#0d0b20", borderBottom: "1px solid #1a1640" }}>
        <div style={{ display: "flex", maxWidth: 960, margin: "0 auto", padding: "0 24px" }}>
          {[9,10,11,12].map(gr => {
            const gc = GRADES[gr]; const active = tab === gr; const tc = gc.tabColor || gc.color;
            return (
              <button key={gr} onClick={() => { setTab(gr); setFilter("All"); setFilterStatus("All"); setOpen(null); setShowForm(false); }}
                style={{ flex: 1, padding: "14px 8px 12px", background: "transparent", border: "none",
                  borderBottom: active ? `2px solid ${tc}` : "2px solid transparent",
                  color: active ? tc : "#3a3860", fontWeight: active ? 700 : 500,
                  fontSize: 12, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase",
                  transition: "all 0.15s", marginBottom: -1 }}>
                {gc.label}
              </button>
            );
          })}
          <button onClick={() => { setTab("vendors"); setOpen(null); setShowForm(false); }}
            style={{ flex: 1, padding: "14px 8px 12px", background: "transparent", border: "none",
              borderBottom: tab === "vendors" ? "2px solid #e0a040" : "2px solid transparent",
              color: tab === "vendors" ? "#e0a040" : "#3a3860",
              fontWeight: tab === "vendors" ? 700 : 500, fontSize: 12, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase", marginBottom: -1 }}>
            Vendors
          </button>
        </div>
      </div>

      {/* ── GRADE STATS BAR ── */}
      {!isVendors && g && !isLoading && (
        <div style={{ background: "#0d0b20", borderBottom: "1px solid #1a1640", padding: "8px 16px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {["All", ...STATUSES].map(s => {
              const on  = filterStatus === s;
              const sc  = s !== "All" ? STATUS_CONFIG[s] : null;
              const cnt = s === "All" ? allTasks.length : counts[s];
              return (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: on ? 700 : 500,
                  background: on ? (sc ? sc.bg : "rgba(255,255,255,0.08)") : "transparent",
                  color: on ? (sc ? sc.color : "#fff") : "#3a3860",
                  border: `1px solid ${on ? (sc ? sc.border : "rgba(255,255,255,0.2)") : "#1a1640"}`,
                  transition: "all 0.15s", whiteSpace: "nowrap"
                }}>{s} <span style={{ opacity: 0.6 }}>{cnt}</span></button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", background: "#100e28", border: "1px solid #1a1640", borderRadius: 6, overflow: "hidden" }}>
              {[["month","Month"],["status","Status"]].map(([val, label]) => (
                <button key={val} onClick={() => setSortBy(val)} style={{
                  padding: "4px 10px", background: sortBy === val ? "#1e1c40" : "transparent",
                  border: "none", color: sortBy === val ? "#a0a0e0" : "#3a3860",
                  fontSize: 11, fontWeight: sortBy === val ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap"
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FILTER + ADD BAR ── */}
      <div style={{ borderBottom: "1px solid #1a1640" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "10px 16px", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", overflowX: "auto", paddingBottom: 2 }}>
            {!isVendors && ["All", ...MONTHS.filter(m => usedMonths.includes(m))].map(m => {
              const on = filter === m;
              return (
                <button key={m} onClick={() => setFilter(m)} style={{
                  padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                  background: on ? tabAcc : "transparent",
                  color: on ? (g?.text || "#0e0c30") : "#3a3860",
                  border: `1px solid ${on ? tabAcc : "#1a1640"}`,
                  fontWeight: on ? 700 : 400, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0
                }}>{m}</button>
              );
            })}
            {isVendors && ["All", ...VENDOR_CATEGORIES.filter(c => usedCats.includes(c))].map(c => {
              const on = filterCat === c;
              return (
                <button key={c} onClick={() => setFilterCat(c)} style={{
                  padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                  background: on ? "#e0a040" : "transparent",
                  color: on ? "#0e0c30" : "#3a3860",
                  border: `1px solid ${on ? "#e0a040" : "#1a1640"}`,
                  fontWeight: on ? 700 : 400, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0
                }}>{c}</button>
              );
            })}
          </div>
          <button onClick={() => isVendors ? startAddVendor() : startAddTask()} className="btn-primary"
            style={{ padding: "8px 16px", borderRadius: 8, background: isVendors ? "#e0a040" : tabAcc,
              color: isVendors ? "#0e0c30" : (g?.text || "#fff"),
              border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              boxShadow: `0 4px 12px ${isVendors ? "#e0a04040" : tabAcc+"40"}` }}>
            + {isVendors ? "Vendor" : "Task"}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 24px 100px" }}>

        {/* ── TASK FORM ── */}
        {showForm && !isVendors && (
          <div style={{ background: "#100e28", border: `1px solid ${tabAcc}55`, borderRadius: 14, padding: 22, marginBottom: 16, boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${tabAcc}22`, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 4, height: 20, background: tabAcc, borderRadius: 2 }} />
              <p style={{ margin: 0, color: tabAcc, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
                {editing ? "Edit Task" : "New Task"} — {g.label}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 148px" }}>
                  <div style={LL}>Month</div>
                  <select value={taskForm.month} onChange={e => setTaskForm(f => ({ ...f, month: e.target.value }))} style={FF}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select>
                </div>
                <div style={{ flex: "0 0 148px" }}>
                  <div style={LL}>Status</div>
                  <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} style={FF}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={LL}>Title *</div>
                  <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task name" style={FF} />
                </div>
              </div>
              <div>
                <div style={LL}>Description</div>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="What's involved, key steps, approvals needed..." style={{ ...FF, resize: "vertical" }} />
              </div>
              <div>
                <div style={LL}>⏱ Lead Time</div>
                <input value={taskForm.leadtime} onChange={e => setTaskForm(f => ({ ...f, leadtime: e.target.value }))} placeholder="e.g. Book 6 months in advance" style={FF} />
              </div>
              <div>
                <div style={LL}>📋 Who to Contact</div>
                <input value={taskForm.contacts} onChange={e => setTaskForm(f => ({ ...f, contacts: e.target.value }))} placeholder="e.g. Mrs. Smith, ext. 204" style={FF} />
              </div>
              <div>
                <div style={LL}>★ Advisor Notes</div>
                <textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Tips, budget, lessons learned..." style={{ ...FF, resize: "vertical" }} />
              </div>
              <div>
                <div style={LL}>✍ Last Edited By</div>
                <input value={taskForm.editedby} onChange={e => setTaskForm(f => ({ ...f, editedby: e.target.value }))} placeholder="Your name" style={FF} />
              </div>
              <div>
                <div style={LL}>📎 Attach File</div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx" style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => fileInputRef.current.click()} disabled={uploading}
                    style={{ padding: "8px 16px", background: uploading ? "#1a1840" : "transparent", color: "#6060a0", border: "1px solid #1a1640", borderRadius: 6, fontSize: 12, cursor: uploading ? "wait" : "pointer" }}>
                    {uploading ? "⏳ Uploading…" : "Choose File"}
                  </button>
                  {taskForm.fileurl && <>
                    <a href={taskForm.fileurl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#60b0e0", textDecoration: "none", fontWeight: 600 }}>📄 View file</a>
                    <button type="button" onClick={() => setTaskForm(f => ({ ...f, fileurl: "" }))} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </>}
                </div>
                <p style={{ margin: "5px 0 0", fontSize: 10, color: "#3a3860" }}>PDF, Word, Excel, PowerPoint, JPEG, PNG</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleSaveTask} disabled={saving || !taskForm.title.trim()} className="btn-primary"
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
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={LL}>Vendor Name *</div>
                  <input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sound Wave DJ" style={FF} />
                </div>
                <div style={{ flex: "0 0 200px", minWidth: 160 }}>
                  <div style={LL}>Category</div>
                  <select value={vendorForm.category} onChange={e => setVendorForm(f => ({ ...f, category: e.target.value }))} style={FF}>
                    {VENDOR_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={LL}>Contact Person</div>
                  <input value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} placeholder="Name" style={FF} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={LL}>Phone</div>
                  <input value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))} placeholder="732-555-0100" style={FF} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={LL}>Email</div>
                  <input value={vendorForm.email} onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" style={FF} />
                </div>
              </div>
              <div>
                <div style={LL}>Notes</div>
                <textarea value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Pricing, experience, recommendations..." style={{ ...FF, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleSaveVendor} disabled={saving || !vendorForm.name.trim()} className="btn-primary"
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
            <div style={{ display: "inline-block", width: 32, height: 32, border: "2px solid #1a1640", borderTop: `2px solid ${tabAcc}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#3a3860", marginTop: 16, fontSize: 13 }}>Loading…</p>
          </div>
        )}

        {/* ── TASK CARDS ── */}
        {!isLoading && !isVendors && taskList.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#2a2860" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
            <p style={{ fontSize: 14 }}>No tasks yet{filter !== "All" ? ` for ${filter}` : ""}. Add one to get started.</p>
          </div>
        )}

        {!isLoading && !isVendors && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {taskList.map(task => {
              const key = `${grade}_${task.title}_${task.month}`;
              const sc  = STATUS_CONFIG[task.status] || STATUS_CONFIG.Planning;
              const days = daysUntil(task.month);
              const hasDetail = task.description || task.leadtime || task.contacts || task.notes || task.fileurl;
              const isOpen = open === key;
              return (
                <div key={key} className="card-hover" style={{
                  background: "#0d0b20", borderRadius: 10,
                  border: `1px solid ${isOpen ? "#2a2560" : "#16143a"}`,
                  borderLeft: `3px solid ${tabAcc}`,
                  overflow: "hidden", transition: "all 0.15s"
                }}>
                  <div onClick={() => setOpen(isOpen ? null : key)}
                    style={{ display: "flex", alignItems: "center", padding: "14px 18px", cursor: "pointer", gap: 12 }}>
                    {/* Month pill */}
                    <span style={{ background: `${tabAcc}18`, color: tabAcc, borderRadius: 6, padding: "3px 10px",
                      fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
                      whiteSpace: "nowrap", minWidth: 76, textAlign: "center", border: `1px solid ${tabAcc}30` }}>
                      {task.month}
                    </span>
                    {/* Title */}
                    <span style={{ flex: 1, color: "#e0deee", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                    {/* Status badge */}
                    {task.status && (
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                        padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap",
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {task.status}
                      </span>
                    )}
                    {/* Countdown */}
                    {days !== null && days > 0 && days <= 60 && !isOpen && (
                      <span style={{ fontSize: 9, color: days <= 14 ? "#ef4444" : "#f59e0b", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {days}d
                      </span>
                    )}
                    {/* Badges */}
                    <div style={{ display: "flex", gap: 3 }}>
                      {task.leadtime && <span style={BADGE("#f59e0b")}>⏱</span>}
                      {task.contacts && <span style={BADGE("#3b82f6")}>📋</span>}
                      {task.fileurl  && <span style={BADGE("#f08060")}>📎</span>}
                    </div>
                    <span style={{ color: "#2a2860", fontSize: 10, marginLeft: 2 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid #16143a", padding: "16px 18px", background: "#0a0818", animation: "fadeIn 0.15s ease" }}>
                      {/* Countdown banner */}
                      {days !== null && days > 0 && days <= 60 && (
                        <div style={{ background: days <= 14 ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${days <= 14 ? "#ef444440" : "#f59e0b40"}`, borderRadius: 8, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13 }}>{days <= 14 ? "🔴" : "🟡"}</span>
                          <span style={{ fontSize: 12, color: days <= 14 ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>
                            {days === 1 ? "Due tomorrow" : `${days} days until ${task.month}`}
                          </span>
                        </div>
                      )}
                      {task.description && <CALLOUT color="#10b981" label="📝 Description" value={task.description} />}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {task.leadtime && <CALLOUT color="#f59e0b" label="⏱ Lead Time" value={task.leadtime} flex />}
                        {task.contacts && <CALLOUT color="#3b82f6" label="📋 Who to Contact" value={task.contacts} flex />}
                      </div>
                      {task.notes    && <CALLOUT color="#a78bfa" label="★ Advisor Notes" value={task.notes} />}
                      {task.fileurl  && (
                        <div style={{ background: "rgba(240,128,96,0.08)", border: "1px solid rgba(240,128,96,0.25)", borderLeft: "3px solid #f08060", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                          <span style={{ display: "block", fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#f08060", marginBottom: 6 }}>📎 Attached File</span>
                          <a href={task.fileurl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#f0a080", textDecoration: "none", fontWeight: 600 }}>Open Document →</a>
                        </div>
                      )}
                      {!hasDetail && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#2a2860", fontStyle: "italic" }}>No details yet — tap Edit to add.</p>}
                      {task.editedby && <p style={{ margin: "0 0 14px", fontSize: 10, color: "#3a3860" }}>✍ Last edited by <span style={{ color: "#6060a0" }}>{task.editedby}</span></p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditTask(task)}
                          style={{ padding: "6px 16px", background: `${tabAcc}18`, color: tabAcc, border: `1px solid ${tabAcc}40`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => setConfirmDelete(task)}
                          style={{ padding: "6px 14px", background: "transparent", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
                  <div onClick={() => setOpen(isOpen ? null : key)}
                    style={{ display: "flex", alignItems: "center", padding: "14px 18px", cursor: "pointer", gap: 12 }}>
                    <span style={{ background: "rgba(224,160,64,0.12)", color: "#e0a040", borderRadius: 6, padding: "3px 10px", fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid rgba(224,160,64,0.25)" }}>{v.category || "Other"}</span>
                    <span style={{ flex: 1, color: "#e0deee", fontSize: 14, fontWeight: 600 }}>{v.name}</span>
                    {v.phone && <span style={{ fontSize: 11, color: "#3a3860" }}>{v.phone}</span>}
                    <span style={{ color: "#2a2860", fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: "1px solid #16143a", padding: "16px 18px", background: "#0a0818", animation: "fadeIn 0.15s ease" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: v.notes ? 12 : 0 }}>
                        {v.contact && <CALLOUT color="#3b82f6" label="👤 Contact" value={v.contact} flex />}
                        {v.phone   && <CALLOUT color="#10b981" label="📞 Phone" value={<a href={`tel:${v.phone}`} style={{ color: "#6ee7b7", textDecoration: "none" }}>{v.phone}</a>} flex />}
                        {v.email   && <CALLOUT color="#a78bfa" label="✉ Email" value={<a href={`mailto:${v.email}`} style={{ color: "#c4b5fd", textDecoration: "none" }}>{v.email}</a>} flex />}
                      </div>
                      {v.notes && <CALLOUT color="#f59e0b" label="★ Notes" value={v.notes} />}
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
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,8,24,0.97)", borderTop: "1px solid #16143a", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", backdropFilter: "blur(12px)" }}>
        <span style={{ color: "#2a2860", fontSize: 11 }}>
          {isLoading ? "Loading…" : isVendors
            ? `${vendorList.length} vendor${vendorList.length !== 1 ? "s" : ""}`
            : `${taskList.length} of ${allTasks.length} tasks · ${g?.label}`}
        </span>
        <span style={{ color: "#2a2860", fontSize: 11 }}>
          {lastUpdated ? `↻ ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "OBHS Advisor Catalog"}
        </span>
      </div>
    </div>
  );
}

// ── CALLOUT COMPONENT ──────────────────────────────────────────────────────
function CALLOUT({ color, label, value, flex }) {
  return (
    <div style={{ ...(flex ? { flex: 1, minWidth: 140 } : {}), background: `${color}12`, border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color, marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 13, color: `${color}cc`, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</span>
    </div>
  );
}

function BADGE(color) {
  return { fontSize: 9, background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 4, padding: "1px 4px" };
}

const FF = { width: "100%", padding: "9px 12px", background: "#080618", color: "#c0c0e0", border: "1px solid #1a1640", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const LL = { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#3a3870", marginBottom: 6 };
