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
  9:  { label: "Freshmen",   color: "#ffffff", text: "#12103a", pill: "rgba(255,255,255,0.15)" },
  10: { label: "Sophomores", color: "#a8a8a8", text: "#12103a", pill: "rgba(168,168,168,0.15)" },
  11: { label: "Juniors",    color: "#4a4a4a", text: "#ffffff",  pill: "rgba(74,74,74,0.4)", tabColor: "#888888" },
  12: { label: "Seniors",    color: "#9b6dff", text: "#ffffff", pill: "rgba(155,109,255,0.18)" },
};

const VENDOR_CATEGORIES = ["DJ / Entertainment","Venue","Clothing / Printing","Catering / Food","Photography / Video","Supplies","Transportation","Other"];

const EMPTY_TASK_FORM    = { month: "August", title: "", description: "", leadtime: "", contacts: "", notes: "", fileurl: "" };
const EMPTY_VENDOR_FORM  = { name: "", category: "DJ / Entertainment", contact: "", phone: "", email: "", notes: "" };

// ─── CSV PARSER ────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line, i) => {
    const cols = [];
    let cur = "", inQ = false;
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

// ─── APPS SCRIPT ───────────────────────────────────────────────────────────
async function callScript(payload) {
  if (APPS_SCRIPT_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") throw new Error("Apps Script URL not configured yet.");
  const res  = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "Script error");
  return json;
}

// ─── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  // "tab" can be 9, 10, 11, 12, or "vendors"
  const [tab, setTab]           = useState(9);
  const [data, setData]         = useState({ 9: [], 10: [], 11: [], 12: [], vendors: [] });
  const [loading, setLoading]   = useState({ 9: true, 10: true, 11: true, 12: true, vendors: true });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState(null);
  const [open, setOpen]         = useState(null);
  const [filter, setFilter]     = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterCat, setFilterCat] = useState("All");
  const fileInputRef = useRef(null);

  const isVendors = tab === "vendors";
  const grade     = isVendors ? null : tab;
  const g         = grade ? GRADES[grade] : null;
  const acc       = g ? g.color : "#e0a040";
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
    } catch {
      setData(prev => ({ ...prev, [t]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [t]: false }));
    }
  }

  useEffect(() => {
    [9, 10, 11, 12, "vendors"].forEach(t => fetchTab(t));
  }, []);

  function flash(type, text) {
    setSaveMsg({ type, text });
    setTimeout(() => setSaveMsg(null), 3500);
  }

  // ── FILE UPLOAD ────────────────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Reset file input so same file can be re-selected after error
    e.target.value = "";
    setUploading(true);
    try {
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const base64 = ev.target.result.split(",")[1];
            const result = await callScript({
              action: "uploadFile",
              fileName: file.name,
              mimeType: file.type,
              base64Data: base64,
            });
            setTaskForm(f => ({ ...f, fileurl: result.url }));
            flash("ok", `Uploaded: ${file.name}`);
            resolve();
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      });
    } catch (err) {
      flash("err", "Upload failed: " + err.message + ". Make sure the Apps Script is redeployed with Drive access.");
    } finally {
      setUploading(false);
    }
  }

  // ── TASK HANDLERS ──────────────────────────────────────────────────────
  function startAddTask() {
    setEditing(null);
    setTaskForm(EMPTY_TASK_FORM);
    setShowForm(true);
    setOpen(null);
  }
  function startEditTask(task) {
    setEditing(task);
    setTaskForm({
      month:       task.month       || "",
      title:       task.title       || "",
      description: task.description || "",
      leadtime:    task.leadtime    || "",
      contacts:    task.contacts    || "",
      notes:       task.notes       || "",
      fileurl:     task.fileurl     || "",
    });
    setShowForm(true);
    setOpen(null);
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await callScript({ action: "update", sheet: SHEET_NAMES[grade], ...taskForm, originalTitle: editing.title, originalMonth: editing.month });
        setData(prev => ({ ...prev, [grade]: prev[grade].map(t =>
          t.title === editing.title && t.month === editing.month ? { ...t, ...taskForm } : t
        )}));
      } else {
        await callScript({ action: "add", sheet: SHEET_NAMES[grade], ...taskForm });
        setData(prev => ({ ...prev, [grade]: [...prev[grade], { ...taskForm, _row: prev[grade].length + 2 }] }));
      }
      setShowForm(false);
      setEditing(null);
      flash("ok", "Saved!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteTask(task) {
    setSaving(true);
    setConfirmDelete(null);
    try {
      await callScript({ action: "delete", sheet: SHEET_NAMES[grade], originalTitle: task.title, originalMonth: task.month });
      setData(prev => ({ ...prev, [grade]: prev[grade].filter(t => !(t.title === task.title && t.month === task.month)) }));
      setOpen(null);
      flash("ok", "Task removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  // ── VENDOR HANDLERS ────────────────────────────────────────────────────
  function startAddVendor() {
    setEditing(null);
    setVendorForm(EMPTY_VENDOR_FORM);
    setShowForm(true);
    setOpen(null);
  }
  function startEditVendor(v) {
    setEditing(v);
    setVendorForm({ name: v.name||"", category: v.category||"DJ / Entertainment", contact: v.contact||"", phone: v.phone||"", email: v.email||"", notes: v.notes||"" });
    setShowForm(true);
    setOpen(null);
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
      setShowForm(false);
      setEditing(null);
      flash("ok", "Vendor saved!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteVendor(v) {
    setSaving(true);
    setConfirmDelete(null);
    try {
      await callScript({ action: "deleteVendor", sheet: "Vendors", originalName: v.name });
      setData(prev => ({ ...prev, vendors: prev.vendors.filter(x => x.name !== v.name) }));
      setOpen(null);
      flash("ok", "Vendor removed!");
    } catch (e) { flash("err", e.message); }
    finally { setSaving(false); }
  }

  // ── DERIVED DATA ───────────────────────────────────────────────────────
  const taskList = grade
    ? (data[grade] || []).filter(t => filter === "All" || t.month === filter)
        .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
    : [];

  const vendorList = (data.vendors || [])
    .filter(v => filterCat === "All" || v.category === filterCat)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const usedMonths = grade ? [...new Set((data[grade] || []).map(t => t.month))] : [];
  const monthFilters = ["All", ...MONTHS.filter(m => usedMonths.includes(m))];
  const usedCats = [...new Set((data.vendors || []).map(v => v.category).filter(Boolean))];
  const catFilters = ["All", ...VENDOR_CATEGORIES.filter(c => usedCats.includes(c))];
  const isLoading = loading[tab];

  return (
    <div style={{ background: "#12103a", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#0e0c30", borderBottom: "1px solid #1e1c4a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: tabAcc, boxShadow: `0 0 6px ${tabAcc}`, flexShrink: 0, transition: "all 0.2s" }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>OBHS</span>
        <span style={{ color: "#5a5880", fontSize: 13 }}>Class Advisor Catalog</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setOpen(null); [9,10,11,12,"vendors"].forEach(t => fetchTab(t)); }} title="Refresh"
          style={{ background: "transparent", border: "none", color: "#5a5880", cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>↻</button>
      </div>

      {/* ── TOAST ── */}
      {saveMsg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: saveMsg.type === "ok" ? "#1a3a1a" : "#3a1a1a",
          border: `1px solid ${saveMsg.type === "ok" ? "#4a9a4a" : "#e05555"}`,
          color: saveMsg.type === "ok" ? "#80e080" : "#e08080",
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
        }}>{saveMsg.text}</div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1a1840", border: "1px solid #3a3860", borderRadius: 12, padding: 24, maxWidth: 320, width: "100%" }}>
            <p style={{ color: "#f0eeff", fontWeight: 700, fontSize: 15, margin: "0 0 8px" }}>
              Remove {isVendors ? "vendor" : "task"}?
            </p>
            <p style={{ color: "#a099c8", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              <strong style={{ color: "#f0eeff" }}>{confirmDelete.title || confirmDelete.name}</strong> will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => isVendors ? handleDeleteVendor(confirmDelete) : handleDeleteTask(confirmDelete)}
                style={{ flex: 1, padding: "10px", background: "#e05555", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Remove</button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "10px", background: "transparent", color: "#a099c8", border: "1px solid #1e1c4a", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e1c4a", background: "#0e0c30" }}>
        {[9,10,11,12].map(gr => {
          const gc = GRADES[gr]; const active = tab === gr; const tc = gc.tabColor || gc.color;
          return (
            <button key={gr} onClick={() => { setTab(gr); setFilter("All"); setOpen(null); setShowForm(false); }}
              style={{ flex: 1, padding: "12px 4px", background: "transparent", border: "none",
                borderBottom: active ? `2px solid ${tc}` : "2px solid transparent",
                color: active ? tc : "#5a5880", fontWeight: active ? 700 : 500,
                fontSize: 12, cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s"
              }}>{gc.label}</button>
          );
        })}
        <button onClick={() => { setTab("vendors"); setOpen(null); setShowForm(false); }}
          style={{ flex: 1, padding: "12px 4px", background: "transparent", border: "none",
            borderBottom: tab === "vendors" ? "2px solid #e0a040" : "2px solid transparent",
            color: tab === "vendors" ? "#e0a040" : "#5a5880",
            fontWeight: tab === "vendors" ? 700 : 500, fontSize: 12, cursor: "pointer", letterSpacing: 0.5
          }}>🏪 Vendors</button>
      </div>

      {/* ── FILTER + ADD BAR ── */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #1e1c4a" }}>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {!isVendors && monthFilters.map(m => {
            const on = filter === m;
            return (
              <button key={m} onClick={() => setFilter(m)} style={{
                padding: "4px 12px", borderRadius: 20,
                background: on ? tabAcc : "transparent",
                color: on ? g.text : "#7068a0",
                border: `1px solid ${on ? tabAcc : "#1e1c4a"}`,
                fontSize: 12, fontWeight: on ? 700 : 400, cursor: "pointer", transition: "all 0.15s"
              }}>{m}</button>
            );
          })}
          {isVendors && catFilters.map(c => {
            const on = filterCat === c;
            return (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                padding: "4px 12px", borderRadius: 20,
                background: on ? "#e0a040" : "transparent",
                color: on ? "#12103a" : "#7068a0",
                border: `1px solid ${on ? "#e0a040" : "#1e1c4a"}`,
                fontSize: 12, fontWeight: on ? 700 : 400, cursor: "pointer", transition: "all 0.15s"
              }}>{c}</button>
            );
          })}
        </div>
        <button onClick={() => isVendors ? startAddVendor() : startAddTask()} style={{
          padding: "7px 16px", borderRadius: 6,
          background: isVendors ? "#e0a040" : tabAcc,
          color: isVendors ? "#12103a" : g.text,
          border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
        }}>{isVendors ? "+ Add Vendor" : "+ Add Task"}</button>
      </div>

      {/* ── TASK FORM ── */}
      {showForm && !isVendors && (
        <div style={{ margin: "12px 16px", background: "#1a1840", border: `1px solid ${tabAcc}`, borderRadius: 10, padding: 18 }}>
          <p style={{ margin: "0 0 14px", color: tabAcc, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            {editing ? "✏ Edit Task" : "＋ New Task"} — {g.label}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 140px", minWidth: 120 }}>
                <div style={LL}>Month</div>
                <select value={taskForm.month} onChange={e => setTaskForm(f => ({ ...f, month: e.target.value }))} style={FF}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={LL}>Title *</div>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Book Prom Venue" style={FF} />
              </div>
            </div>
            <div>
              <div style={LL}>Description</div>
              <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="What's involved, key steps, approvals needed..." style={{ ...FF, resize: "vertical" }} />
            </div>
            <div>
              <div style={LL}>⏱ Lead Time</div>
              <input value={taskForm.leadtime} onChange={e => setTaskForm(f => ({ ...f, leadtime: e.target.value }))}
                placeholder="e.g. Book 6 months in advance" style={FF} />
            </div>
            <div>
              <div style={LL}>📋 Who to Contact</div>
              <input value={taskForm.contacts} onChange={e => setTaskForm(f => ({ ...f, contacts: e.target.value }))}
                placeholder="e.g. Mrs. Smith, ext. 204" style={FF} />
            </div>
            <div>
              <div style={LL}>★ Advisor Notes</div>
              <textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Tips, budget, lessons learned..." style={{ ...FF, resize: "vertical" }} />
            </div>

            {/* File Upload */}
            <div>
              <div style={LL}>📎 Attach File</div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx"
                style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => fileInputRef.current.click()} disabled={uploading}
                  style={{ padding: "8px 16px", background: "transparent", color: "#a099c8",
                    border: "1px solid #1e1c4a", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                  {uploading ? "Uploading…" : "Choose File"}
                </button>
                {taskForm.fileurl && (
                  <a href={taskForm.fileurl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "#60b0e0", textDecoration: "none" }}>
                    📄 View uploaded file
                  </a>
                )}
                {taskForm.fileurl && (
                  <button type="button" onClick={() => setTaskForm(f => ({ ...f, fileurl: "" }))}
                    style={{ background: "transparent", border: "none", color: "#e05555", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                )}
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#5a5880" }}>
                PDF, Word, Excel, PowerPoint, JPEG, PNG supported
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleSaveTask} disabled={saving || !taskForm.title.trim()}
              style={{ padding: "9px 20px", background: saving ? "#2a2850" : tabAcc,
                color: saving ? "#5a5880" : g.text, border: "none", borderRadius: 7,
                fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Task"}
            </button>
            <button onClick={() => setShowForm(false)} disabled={saving}
              style={{ padding: "9px 16px", background: "transparent", color: "#7068a0",
                border: "1px solid #1e1c4a", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── VENDOR FORM ── */}
      {showForm && isVendors && (
        <div style={{ margin: "12px 16px", background: "#1a1840", border: "1px solid #e0a040", borderRadius: 10, padding: 18 }}>
          <p style={{ margin: "0 0 14px", color: "#e0a040", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            {editing ? "✏ Edit Vendor" : "＋ New Vendor"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={LL}>Vendor Name *</div>
                <input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sound Wave DJ" style={FF} />
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
                <input value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder="e.g. Mike Johnson" style={FF} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={LL}>Phone</div>
                <input value={vendorForm.phone} onChange={e => setVendorForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 732-555-0100" style={FF} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={LL}>Email</div>
                <input value={vendorForm.email} onChange={e => setVendorForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. mike@soundwave.com" style={FF} />
              </div>
            </div>
            <div>
              <div style={LL}>Notes</div>
              <textarea value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Pricing, experience, recommendations..." style={{ ...FF, resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleSaveVendor} disabled={saving || !vendorForm.name.trim()}
              style={{ padding: "9px 20px", background: saving ? "#2a2850" : "#e0a040",
                color: saving ? "#5a5880" : "#12103a", border: "none", borderRadius: 7,
                fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Vendor"}
            </button>
            <button onClick={() => setShowForm(false)} disabled={saving}
              style={{ padding: "9px 16px", background: "transparent", color: "#7068a0",
                border: "1px solid #1e1c4a", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ padding: "12px 16px 80px", display: "flex", flexDirection: "column", gap: 8 }}>

        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid #1e1c4a`, borderTop: `3px solid ${tabAcc}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#5a5880", marginTop: 14, fontSize: 13 }}>Loading…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ── TASK CARDS ── */}
        {!isLoading && !isVendors && taskList.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#3a3860", fontSize: 14 }}>
            No tasks yet{filter !== "All" ? ` for ${filter}` : ""}. Tap + Add Task to get started.
          </div>
        )}

        {!isLoading && !isVendors && taskList.map(task => {
          const hasDetail = task.description || task.leadtime || task.contacts || task.notes || task.fileurl;
          const key = `${grade}_${task.title}_${task.month}`;
          return (
            <div key={key} style={{ background: "#1a1840", borderRadius: 10, border: "1px solid #1e1c4a", borderLeft: `3px solid ${tabAcc}`, overflow: "hidden" }}>
              <div onClick={() => setOpen(open === key ? null : key)}
                style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}>
                <span style={{ background: g.pill, color: tabAcc, borderRadius: 4, padding: "2px 8px",
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  whiteSpace: "nowrap", minWidth: 72, textAlign: "center" }}>{task.month}</span>
                <span style={{ flex: 1, color: "#f0eeff", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {task.leadtime && <span style={{ fontSize: 9, background: "rgba(255,200,80,0.12)", color: "#c8a030", border: "1px solid rgba(255,200,80,0.2)", borderRadius: 4, padding: "2px 5px" }}>⏱</span>}
                  {task.contacts && <span style={{ fontSize: 9, background: "rgba(80,180,255,0.1)",  color: "#60b0e0", border: "1px solid rgba(80,180,255,0.2)",  borderRadius: 4, padding: "2px 5px" }}>📋</span>}
                  {task.fileurl  && <span style={{ fontSize: 9, background: "rgba(255,120,80,0.1)",  color: "#f08060", border: "1px solid rgba(255,120,80,0.2)",  borderRadius: 4, padding: "2px 5px" }}>📎</span>}
                </div>
                <span style={{ color: "#3a3860", fontSize: 11 }}>{open === key ? "▲" : "▼"}</span>
              </div>

              {open === key && (
                <div style={{ borderTop: "1px solid #1e1c4a", padding: "14px 16px", background: "#16143a" }}>
                  {task.description && (
                    <div style={{ background: "rgba(40,200,120,0.07)", border: "1px solid rgba(40,200,120,0.2)", borderLeft: "3px solid #28c878", borderRadius: 6, padding: "10px 12px", marginBottom: 14 }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#28c878", marginBottom: 4 }}>📝 Description</span>
                      <span style={{ fontSize: 13, color: "#80e8b0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{task.description}</span>
                    </div>
                  )}
                  {(task.leadtime || task.contacts) && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                      {task.leadtime && (
                        <div style={{ flex: 1, minWidth: 140, background: "rgba(255,200,80,0.08)", border: "1px solid rgba(255,200,80,0.2)", borderLeft: "3px solid #c8a030", borderRadius: 6, padding: "10px 12px" }}>
                          <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#c8a030", marginBottom: 4 }}>⏱ Lead Time</span>
                          <span style={{ fontSize: 13, color: "#e8d080", lineHeight: 1.5 }}>{task.leadtime}</span>
                        </div>
                      )}
                      {task.contacts && (
                        <div style={{ flex: 1, minWidth: 140, background: "rgba(80,180,255,0.08)", border: "1px solid rgba(80,180,255,0.2)", borderLeft: "3px solid #4090c0", borderRadius: 6, padding: "10px 12px" }}>
                          <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#60b0e0", marginBottom: 4 }}>📋 Who to Contact</span>
                          <span style={{ fontSize: 13, color: "#90c8f0", lineHeight: 1.5 }}>{task.contacts}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {task.notes && (
                    <div style={{ background: "rgba(155,109,255,0.1)", border: "1px solid rgba(155,109,255,0.25)", borderLeft: "3px solid #9b6dff", borderRadius: 6, padding: "10px 12px", marginBottom: 14 }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#9b6dff", marginBottom: 4 }}>★ Advisor Notes</span>
                      <span style={{ fontSize: 13, color: "#c4a0ff", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.notes}</span>
                    </div>
                  )}
                  {task.fileurl && (
                    <div style={{ background: "rgba(255,120,80,0.07)", border: "1px solid rgba(255,120,80,0.2)", borderLeft: "3px solid #f08060", borderRadius: 6, padding: "10px 12px", marginBottom: 14 }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#f08060", marginBottom: 6 }}>📎 Attached File</span>
                      <a href={task.fileurl} target="_blank" rel="noreferrer"
                        style={{ fontSize: 13, color: "#f0a080", textDecoration: "none", fontWeight: 600 }}>
                        Open Document →
                      </a>
                    </div>
                  )}
                  {!hasDetail && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#3a3860", fontStyle: "italic" }}>No details yet. Tap Edit to add.</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEditTask(task)}
                      style={{ padding: "6px 14px", background: "transparent", color: tabAcc, border: `1px solid ${tabAcc}55`, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => setConfirmDelete(task)}
                      style={{ padding: "6px 14px", background: "transparent", color: "#e05555", border: "1px solid #e0555533", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── VENDOR CARDS ── */}
        {!isLoading && isVendors && vendorList.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#3a3860", fontSize: 14 }}>
            No vendors yet. Tap + Add Vendor to get started.
          </div>
        )}

        {!isLoading && isVendors && vendorList.map(v => {
          const key = `vendor_${v.name}`;
          return (
            <div key={key} style={{ background: "#1a1840", borderRadius: 10, border: "1px solid #1e1c4a", borderLeft: "3px solid #e0a040", overflow: "hidden" }}>
              <div onClick={() => setOpen(open === key ? null : key)}
                style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}>
                <span style={{ background: "rgba(224,160,64,0.15)", color: "#e0a040", borderRadius: 4,
                  padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  whiteSpace: "nowrap", textAlign: "center" }}>{v.category || "Other"}</span>
                <span style={{ flex: 1, color: "#f0eeff", fontSize: 14, fontWeight: 600 }}>{v.name}</span>
                {v.phone && <span style={{ fontSize: 11, color: "#5a5880" }}>{v.phone}</span>}
                <span style={{ color: "#3a3860", fontSize: 11 }}>{open === key ? "▲" : "▼"}</span>
              </div>

              {open === key && (
                <div style={{ borderTop: "1px solid #1e1c4a", padding: "14px 16px", background: "#16143a" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: v.notes ? 14 : 0 }}>
                    {v.contact && (
                      <div style={{ flex: 1, minWidth: 140, background: "rgba(80,180,255,0.08)", border: "1px solid rgba(80,180,255,0.2)", borderLeft: "3px solid #4090c0", borderRadius: 6, padding: "10px 12px" }}>
                        <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#60b0e0", marginBottom: 4 }}>👤 Contact Person</span>
                        <span style={{ fontSize: 13, color: "#90c8f0" }}>{v.contact}</span>
                      </div>
                    )}
                    {v.phone && (
                      <div style={{ flex: 1, minWidth: 120, background: "rgba(40,200,120,0.07)", border: "1px solid rgba(40,200,120,0.2)", borderLeft: "3px solid #28c878", borderRadius: 6, padding: "10px 12px" }}>
                        <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#28c878", marginBottom: 4 }}>📞 Phone</span>
                        <a href={`tel:${v.phone}`} style={{ fontSize: 13, color: "#80e8b0", textDecoration: "none" }}>{v.phone}</a>
                      </div>
                    )}
                    {v.email && (
                      <div style={{ flex: 1, minWidth: 180, background: "rgba(155,109,255,0.1)", border: "1px solid rgba(155,109,255,0.25)", borderLeft: "3px solid #9b6dff", borderRadius: 6, padding: "10px 12px" }}>
                        <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#9b6dff", marginBottom: 4 }}>✉ Email</span>
                        <a href={`mailto:${v.email}`} style={{ fontSize: 13, color: "#c4a0ff", textDecoration: "none" }}>{v.email}</a>
                      </div>
                    )}
                  </div>
                  {v.notes && (
                    <div style={{ background: "rgba(255,200,80,0.08)", border: "1px solid rgba(255,200,80,0.2)", borderLeft: "3px solid #c8a030", borderRadius: 6, padding: "10px 12px", marginTop: 10, marginBottom: 14 }}>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#c8a030", marginBottom: 4 }}>★ Notes</span>
                      <span style={{ fontSize: 13, color: "#e8d080", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{v.notes}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => startEditVendor(v)}
                      style={{ padding: "6px 14px", background: "transparent", color: "#e0a040", border: "1px solid #e0a04055", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => setConfirmDelete(v)}
                      style={{ padding: "6px 14px", background: "transparent", color: "#e05555", border: "1px solid #e0555533", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0c30", borderTop: "1px solid #1e1c4a", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#3a3860", fontSize: 11 }}>
          {isLoading ? "Loading…" : isVendors
            ? `${vendorList.length} vendor${vendorList.length !== 1 ? "s" : ""}`
            : `${taskList.length} task${taskList.length !== 1 ? "s" : ""} · ${g.label}`}
        </span>
        <span style={{ color: "#3a3860", fontSize: 11 }}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "OBHS Advisor Catalog"}
        </span>
      </div>
    </div>
  );
}

const FF = { width: "100%", padding: "9px 11px", background: "#0e0c30", color: "#e0deee", border: "1px solid #1e1c4a", borderRadius: 6, fontSize: 13, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" };
const LL = { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#5a5880", marginBottom: 5 };
