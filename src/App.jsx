import { useState, useEffect } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

const SHEET_URLS = {
  9:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=0&single=true&output=csv",
  10: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=955151150&single=true&output=csv",
  11: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=1311311312&single=true&output=csv",
  12: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=449365991&single=true&output=csv",
};

const SHEET_NAMES = { 9: "Freshmen", 10: "Sophomores", 11: "Juniors", 12: "Seniors" };

const MONTHS = ["August","September","October","November","December","January","February","March","April","May","June","July"];

const GRADES = {
  9:  { label: "Freshmen",   color: "#ffffff", text: "#12103a", pill: "rgba(255,255,255,0.15)" },
  10: { label: "Sophomores", color: "#a8a8a8", text: "#12103a", pill: "rgba(168,168,168,0.15)" },
  11: { label: "Juniors",    color: "#4a4a4a", text: "#ffffff",  pill: "rgba(74,74,74,0.4)", tabColor: "#888888" },
  12: { label: "Seniors",    color: "#9b6dff", text: "#ffffff", pill: "rgba(155,109,255,0.18)" },
};

const EMPTY_FORM = { month: "August", title: "", description: "", leadtime: "", contacts: "", notes: "" };

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
    // Always track the actual sheet row number (row 2 = index 0, so +2)
    // This is what the Apps Script uses to find and update the correct row
    obj._row = i + 2; // actual sheet row (header=1, first data row=2)
    return obj;
  }).filter(r => r.title || r.month);
}

// ─── APPS SCRIPT ───────────────────────────────────────────────────────────
async function callScript(payload) {
  if (APPS_SCRIPT_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    throw new Error("Apps Script URL not configured yet.");
  }
  const res  = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message || "Script error");
  return json;
}

// ─── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [grade, setGrade]       = useState(9);
  const [data, setData]         = useState({ 9: [], 10: [], 11: [], 12: [] });
  const [loading, setLoading]   = useState({ 9: true, 10: true, 11: true, 12: true });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState(null);
  const [open, setOpen]         = useState(null); // stores "grade_id"
  const [filter, setFilter]     = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [refreshing, setRefreshing]     = useState(false);

  const g      = GRADES[grade];
  const acc    = g.color;
  const tabAcc = g.tabColor || g.color;

  async function fetchGrade(gr, silent = false) {
    if (!silent) setLoading(prev => ({ ...prev, [gr]: true }));
    if (silent) setRefreshing(true);
    try {
      const res  = await fetch(SHEET_URLS[gr] + "&t=" + Date.now());
      const text = await res.text();
      setData(prev => ({ ...prev, [gr]: parseCSV(text) }));
      if (gr === 9 || silent) setLastUpdated(new Date());
    } catch {
      setData(prev => ({ ...prev, [gr]: [] }));
    } finally {
      if (!silent) setLoading(prev => ({ ...prev, [gr]: false }));
      if (silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    [9,10,11,12].forEach(gr => fetchGrade(gr));
    const interval = setInterval(() => {
      [9,10,11,12].forEach(gr => fetchGrade(gr, true));
    }, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, []);

  function flash(type, text) {
    setSaveMsg({ type, text });
    setTimeout(() => setSaveMsg(null), 3500);
  }

  function startAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setOpen(null);
  }
  function startEdit(task) {
    setEditing(task);
    setForm({
      month:       task.month       || "",
      title:       task.title       || "",
      description: task.description || "",
      leadtime:    task.leadtime    || "",
      contacts:    task.contacts    || "",
      notes:       task.notes       || "",
    });
    setShowForm(true);
    setOpen(null);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
await callScript({ action: "update", sheet: SHEET_NAMES[grade], ...form, originalTitle: editing.title, originalMonth: editing.month })
      } else {
        await callScript({ action: "add", sheet: SHEET_NAMES[grade], ...form });
      }
      setShowForm(false);
      // Delay re-fetch to allow Google Sheets cache to update (~5s lag)
      flash("ok", editing ? "Saved! Refreshing shortly…" : "Added! Refreshing shortly…");
      setTimeout(() => fetchGrade(grade), 7000);
    } catch (e) {
      flash("err", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task) {
    setSaving(true);
    setConfirmDelete(null);
    try {
      await callScript({ action: "delete", sheet: SHEET_NAMES[grade], originalTitle: task.title, originalMonth: task.month });
      flash("ok", "Task removed! Refreshing shortly…");
      setOpen(null);
      setTimeout(() => fetchGrade(grade), 7000);
    } catch (e) {
      flash("err", e.message);
    } finally {
      setSaving(false);
    }
  }

  const list = (data[grade] || [])
    .filter(t => filter === "All" || t.month === filter)
    .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

  const usedMonths = [...new Set((data[grade] || []).map(t => t.month))];
  const filters    = ["All", ...MONTHS.filter(m => usedMonths.includes(m))];
  const isLoading  = loading[grade];

  return (
    <div style={{ background: "#12103a", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#0e0c30", borderBottom: "1px solid #1e1c4a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: tabAcc, boxShadow: `0 0 6px ${tabAcc}`, flexShrink: 0, transition: "all 0.2s" }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>OBHS</span>
        <span style={{ color: "#5a5880", fontSize: 13 }}>Class Advisor Catalog</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => [9,10,11,12].forEach(gr => fetchGrade(gr, true))} title="Refresh from Google Sheets"
          style={{ background: "transparent", border: "none", color: refreshing ? tabAcc : "#5a5880", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px", transition: "color 0.3s", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</button>
      </div>

      {/* ── TOAST ── */}
      {saveMsg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
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
            <p style={{ color: "#f0eeff", fontWeight: 700, fontSize: 15, margin: "0 0 8px" }}>Remove this task?</p>
            <p style={{ color: "#a099c8", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              <strong style={{ color: "#f0eeff" }}>{confirmDelete.title}</strong> will be permanently removed from the sheet.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDelete(confirmDelete)}
                style={{ flex: 1, padding: "10px", background: "#e05555", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Remove</button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: "10px", background: "transparent", color: "#a099c8", border: "1px solid #1e1c4a", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GRADE TABS ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e1c4a", background: "#0e0c30" }}>
        {[9,10,11,12].map(gr => {
          const gc     = GRADES[gr];
          const active = grade === gr;
          const tc     = gc.tabColor || gc.color;
          return (
            <button key={gr} onClick={() => { setGrade(gr); setFilter("All"); setOpen(null); setShowForm(false); }}
              style={{
                flex: 1, padding: "12px 4px", background: "transparent", border: "none",
                borderBottom: active ? `2px solid ${tc}` : "2px solid transparent",
                color: active ? tc : "#5a5880",
                fontWeight: active ? 700 : 500, fontSize: 12,
                cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s"
              }}>{gc.label}</button>
          );
        })}
      </div>

      {/* ── FILTER + ADD ── */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #1e1c4a" }}>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {filters.map(m => {
            const on = filter === m;
            return (
              <button key={m} onClick={() => setFilter(m)} style={{
                padding: "4px 12px", borderRadius: 20,
                background: on ? tabAcc : "transparent",
                color: on ? g.text : "#7068a0",
                border: `1px solid ${on ? tabAcc : "#1e1c4a"}`,
                fontSize: 12, fontWeight: on ? 700 : 400,
                cursor: "pointer", transition: "all 0.15s"
              }}>{m}</button>
            );
          })}
        </div>
        <button onClick={startAdd} style={{
          padding: "7px 16px", borderRadius: 6,
          background: tabAcc, color: g.text,
          border: "none", fontSize: 12, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap"
        }}>+ Add Task</button>
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div style={{ margin: "12px 16px", background: "#1a1840", border: `1px solid ${tabAcc}`, borderRadius: 10, padding: 18 }}>
          <p style={{ margin: "0 0 14px", color: tabAcc, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            {editing ? "✏ Edit Task" : "＋ New Task"} — {g.label}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Month + Title */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 140px", minWidth: 120 }}>
                <div style={LL}>Month</div>
                <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} style={FF}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={LL}>Title *</div>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Book Prom Venue" style={FF} />
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={LL}>Description</div>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="What's involved, key steps, approvals needed..."
                style={{ ...FF, resize: "vertical" }} />
            </div>

            {/* Lead Time + Who to Contact side by side on wider screens */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={LL}>⏱ Lead Time</div>
                <input value={form.leadtime} onChange={e => setForm(f => ({ ...f, leadtime: e.target.value }))}
                  placeholder="e.g. Book 6 months in advance" style={FF} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={LL}>📋 Who to Contact</div>
                <input value={form.contacts} onChange={e => setForm(f => ({ ...f, contacts: e.target.value }))}
                  placeholder="e.g. Mrs. Smith, ext. 204" style={FF} />
              </div>
            </div>

            {/* Advisor Notes */}
            <div>
              <div style={LL}>★ Advisor Notes</div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Tips, budget, lessons learned..."
                style={{ ...FF, resize: "vertical" }} />
            </div>

          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              style={{
                padding: "9px 20px", background: saving ? "#2a2850" : tabAcc,
                color: saving ? "#5a5880" : g.text,
                border: "none", borderRadius: 7, fontSize: 13,
                fontWeight: 700, cursor: saving ? "wait" : "pointer"
              }}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Task"}</button>
            <button onClick={() => setShowForm(false)} disabled={saving}
              style={{ padding: "9px 16px", background: "transparent", color: "#7068a0", border: "1px solid #1e1c4a", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── TASK LIST ── */}
      <div style={{ padding: "12px 16px 80px", display: "flex", flexDirection: "column", gap: 8 }}>

        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid #1e1c4a`, borderTop: `3px solid ${tabAcc}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#5a5880", marginTop: 14, fontSize: 13 }}>Loading…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#3a3860", fontSize: 14 }}>
            No tasks yet{filter !== "All" ? ` for ${filter}` : ""}. Tap + Add Task to get started.
          </div>
        )}

        {!isLoading && list.map(task => {
          const hasDetail = task.description || task.leadtime || task.contacts || task.notes;
          return (
            <div key={task.id} style={{
              background: "#1a1840", borderRadius: 10,
              border: "1px solid #1e1c4a",
              borderLeft: `3px solid ${tabAcc}`,
              overflow: "hidden"
            }}>
              {/* Row */}
              <div onClick={() => setOpen(open === `${grade}_${task.id}` ? null : `${grade}_${task.id}`)}
                style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}>
                <span style={{
                  background: g.pill, color: tabAcc, borderRadius: 4,
                  padding: "2px 8px", fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, textTransform: "uppercase",
                  whiteSpace: "nowrap", minWidth: 72, textAlign: "center"
                }}>{task.month}</span>
                <span style={{ flex: 1, color: "#f0eeff", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                {/* Show badge pills for lead time / contacts if present */}
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {task.leadtime  && <span style={{ fontSize: 9, background: "rgba(255,200,80,0.12)", color: "#c8a030", border: "1px solid rgba(255,200,80,0.2)", borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap" }}>⏱</span>}
                  {task.contacts  && <span style={{ fontSize: 9, background: "rgba(80,180,255,0.1)",  color: "#60b0e0", border: "1px solid rgba(80,180,255,0.2)",  borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap" }}>📋</span>}
                </div>
                <span style={{ color: "#3a3860", fontSize: 11 }}>{open === `${grade}_${task.id}` ? "▲" : "▼"}</span>
              </div>

              {/* Expanded */}
              {open === `${grade}_${task.id}` && (
                <div style={{ borderTop: "1px solid #1e1c4a", padding: "14px 16px", background: "#16143a" }}>

                  {task.description && (
                    <p style={{ margin: "0 0 14px", fontSize: 14, color: "#a099c8", lineHeight: 1.7 }}>{task.description}</p>
                  )}

                  {/* Lead Time + Contacts row */}
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
                      <span style={{ fontSize: 13, color: "#c4a0ff", lineHeight: 1.6 }}>{task.notes}</span>
                    </div>
                  )}

                  {!hasDetail && (
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "#3a3860", fontStyle: "italic" }}>No details yet. Tap Edit to add.</p>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(task)}
                      style={{ padding: "6px 14px", background: "transparent", color: tabAcc, border: `1px solid ${tabAcc}55`, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => setConfirmDelete(task)}
                      style={{ padding: "6px 14px", background: "transparent", color: "#e05555", border: "1px solid #e0555533", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                      Remove
                    </button>
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
          {isLoading ? "Loading…" : `${list.length} task${list.length !== 1 ? "s" : ""} · ${g.label}`}
        </span>
        <span style={{ color: "#3a3860", fontSize: 11 }}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "OBHS Advisor Catalog"}
        </span>
      </div>
    </div>
  );
}

const FF = {
  width: "100%", padding: "9px 11px",
  background: "#0e0c30", color: "#e0deee",
  border: "1px solid #1e1c4a", borderRadius: 6,
  fontSize: 13, fontFamily: "system-ui, sans-serif",
  boxSizing: "border-box"
};
const LL = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
  textTransform: "uppercase", color: "#5a5880", marginBottom: 5
};
