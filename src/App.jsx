import { useState, useEffect } from "react";

const MONTHS = ["August","September","October","November","December","January","February","March","April","May","June","July"];

const GRADES = {
  9:  { label: "Freshmen",   color: "#ffffff", text: "#12103a", pill: "rgba(255,255,255,0.15)" },
  10: { label: "Sophomores", color: "#a8a8a8", text: "#12103a", pill: "rgba(168,168,168,0.15)" },
  11: { label: "Juniors",    color: "#d0d0d0", text: "#0a0a0a", pill: "rgba(180,180,180,0.12)" },
  12: { label: "Seniors",    color: "#9b6dff", text: "#ffffff", pill: "rgba(155,109,255,0.18)" },
};

const SHEET_URLS = {
  9:  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=0&single=true&output=csv",
  10: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=955151150&single=true&output=csv",
  11: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=1311311312&single=true&output=csv",
  12: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGHy4-6p1j_bOVwekZA4jCK4lSSGYdIgPaFQhrZ77kXC8XNUF5VlmkdB_V_BGiShSrbiPh12W7Imz8/pub?gid=449365991&single=true&output=csv",
};

// Parse CSV text into array of row objects using header row as keys
function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line, i) => {
    // Handle quoted fields with commas inside
    const cols = [];
    let cur = "", inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur);
    const obj = { id: i + 1 };
    headers.forEach((h, idx) => { obj[h] = (cols[idx] || "").replace(/^"|"$/g, "").trim(); });
    return obj;
  }).filter(r => r.title || r.month); // skip empty rows
}

export default function App() {
  const [grade, setGrade]       = useState(9);
  const [data, setData]         = useState({ 9: [], 10: [], 11: [], 12: [] });
  const [loading, setLoading]   = useState({ 9: true, 10: true, 11: true, 12: true });
  const [error, setError]       = useState({ 9: null, 10: null, 11: null, 12: null });
  const [open, setOpen]         = useState(null);
  const [filter, setFilter]     = useState("All");
  const [lastFetch, setLastFetch] = useState(null);

  // Fetch a single grade's sheet
  async function fetchGrade(gr) {
    setLoading(prev => ({ ...prev, [gr]: true }));
    setError(prev => ({ ...prev, [gr]: null }));
    try {
      const res = await fetch(SHEET_URLS[gr] + "&t=" + Date.now()); // cache-bust
      if (!res.ok) throw new Error("Failed to load");
      const text = await res.text();
      const rows = parseCSV(text);
      setData(prev => ({ ...prev, [gr]: rows }));
      setLastFetch(new Date());
    } catch (e) {
      setError(prev => ({ ...prev, [gr]: "Couldn't load data. Check your sheet is published." }));
    } finally {
      setLoading(prev => ({ ...prev, [gr]: false }));
    }
  }

  // Fetch all grades on mount
  useEffect(() => {
    [9, 10, 11, 12].forEach(fetchGrade);
  }, []);

  const g   = GRADES[grade];
  const acc = g.color;

  const list = (data[grade] || [])
    .filter(t => filter === "All" || t.month === filter)
    .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

  const usedMonths = [...new Set((data[grade] || []).map(t => t.month))];
  const filters    = ["All", ...MONTHS.filter(m => usedMonths.includes(m))];

  const isLoading = loading[grade];
  const hasError  = error[grade];

  return (
    <div style={{ background: "#12103a", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#0e0c30", borderBottom: "1px solid #1e1c4a", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: acc, boxShadow: `0 0 6px ${acc}`, flexShrink: 0, transition: "all 0.2s" }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>OBHS</span>
        <span style={{ color: "#5a5880", fontSize: 13 }}>Class Advisor Catalog</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => [9,10,11,12].forEach(fetchGrade)}
          title="Refresh from Google Sheets"
          style={{ background: "transparent", border: "none", color: "#5a5880", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
          ↻
        </button>
      </div>

      {/* ── GRADE TABS ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e1c4a", background: "#0e0c30" }}>
        {[9, 10, 11, 12].map(gr => {
          const gc = GRADES[gr];
          const active = grade === gr;
          return (
            <button key={gr}
              onClick={() => { setGrade(gr); setFilter("All"); setOpen(null); }}
              style={{
                flex: 1, padding: "12px 4px",
                background: "transparent", border: "none",
                borderBottom: active ? `2px solid ${gc.color}` : "2px solid transparent",
                color: active ? gc.color : "#5a5880",
                fontWeight: active ? 700 : 500,
                fontSize: 12, cursor: "pointer",
                letterSpacing: 0.5, transition: "all 0.15s"
              }}>
              {gc.label}
            </button>
          );
        })}
      </div>

      {/* ── FILTER BAR ── */}
      {!isLoading && !hasError && (
        <div style={{ padding: "12px 16px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #1e1c4a" }}>
          {filters.map(m => {
            const on = filter === m;
            return (
              <button key={m} onClick={() => setFilter(m)} style={{
                padding: "4px 12px", borderRadius: 20,
                background: on ? acc : "transparent",
                color: on ? g.text : "#7068a0",
                border: `1px solid ${on ? acc : "#1e1c4a"}`,
                fontSize: 12, fontWeight: on ? 700 : 400,
                cursor: "pointer", transition: "all 0.15s"
              }}>{m}</button>
            );
          })}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ padding: "16px 16px 48px" }}>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: `3px solid #1e1c4a`, borderTop: `3px solid ${acc}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#5a5880", marginTop: 16, fontSize: 13 }}>Loading {g.label} tasks…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!isLoading && hasError && (
          <div style={{ margin: "20px 0", background: "#2a1020", border: "1px solid #e05555", borderRadius: 8, padding: "16px 20px" }}>
            <p style={{ color: "#e05555", margin: "0 0 8px", fontWeight: 700, fontSize: 13 }}>Couldn't load data</p>
            <p style={{ color: "#a08080", margin: "0 0 12px", fontSize: 12 }}>{hasError}</p>
            <button onClick={() => fetchGrade(grade)} style={{ padding: "6px 16px", background: "#e05555", color: "#fff", border: "none", borderRadius: 5, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !hasError && list.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#3a3860", fontSize: 14 }}>
            No tasks found{filter !== "All" ? ` for ${filter}` : ""}.
          </div>
        )}

        {/* Task cards */}
        {!isLoading && !hasError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map(task => (
              <div key={task.id} style={{
                background: "#1a1840", borderRadius: 10,
                border: "1px solid #1e1c4a",
                borderLeft: `3px solid ${acc}`,
                overflow: "hidden"
              }}>
                {/* Row */}
                <div onClick={() => setOpen(open === task.id ? null : task.id)}
                  style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}>
                  <span style={{
                    background: g.pill, color: acc,
                    borderRadius: 4, padding: "2px 8px",
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: 1, textTransform: "uppercase",
                    whiteSpace: "nowrap", minWidth: 72, textAlign: "center"
                  }}>{task.month}</span>
                  <span style={{ flex: 1, color: "#f0eeff", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</span>
                  {(task.description || task.notes) && (
                    <span style={{ color: "#3a3860", fontSize: 11 }}>{open === task.id ? "▲" : "▼"}</span>
                  )}
                </div>

                {/* Expanded */}
                {open === task.id && (task.description || task.notes) && (
                  <div style={{ borderTop: "1px solid #1e1c4a", padding: "14px 16px", background: "#16143a" }}>
                    {task.description && (
                      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#a099c8", lineHeight: 1.7 }}>{task.description}</p>
                    )}
                    {task.notes && (
                      <div style={{ background: "rgba(155,109,255,0.1)", border: "1px solid rgba(155,109,255,0.25)", borderLeft: "3px solid #9b6dff", borderRadius: 6, padding: "10px 12px" }}>
                        <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#9b6dff", marginBottom: 4 }}>Advisor Notes</span>
                        <span style={{ fontSize: 13, color: "#c4a0ff", lineHeight: 1.6 }}>{task.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      {!isLoading && !hasError && (
        <div style={{ padding: "0 16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ color: "#3a3860", fontSize: 11 }}>
            {list.length} task{list.length !== 1 ? "s" : ""} · {g.label}
            {lastFetch && ` · Updated ${lastFetch.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        </div>
      )}
    </div>
  );
}
