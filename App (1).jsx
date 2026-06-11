import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";

// ─── Tiny DB (replaces Wix BaseCrudService) ───────────────────────────────────
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getCol(name) {
  try { return JSON.parse(localStorage.getItem(`bmb_${name}`) || "[]"); } catch { return []; }
}
function setCol(name, items) { localStorage.setItem(`bmb_${name}`, JSON.stringify(items)); }

const db = {
  getAll(col, filters = {}, opts = {}) {
    let items = getCol(col);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") items = items.filter(i => i[k] === v);
    });
    const skip = opts.skip || 0;
    const limit = opts.limit || 200;
    return { items: items.slice(skip, skip + limit), hasNext: items.length > skip + limit, total: items.length };
  },
  getById(col, id) { return getCol(col).find(i => i._id === id) || null; },
  create(col, data) {
    const items = getCol(col);
    const rec = { ...data, _id: data._id || genId(), _createdDate: new Date().toISOString(), _updatedDate: new Date().toISOString() };
    items.unshift(rec); setCol(col, items); return rec;
  },
  update(col, data) {
    const items = getCol(col);
    const idx = items.findIndex(i => i._id === data._id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...data, _updatedDate: new Date().toISOString() };
    setCol(col, items); return items[idx];
  },
  delete(col, id) { setCol(col, getCol(col).filter(i => i._id !== id)); return true; },
};

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bmb_user") || "null"); } catch { return null; }
  });

  const login = (userData) => {
    const u = { ...userData, id: userData.id || genId() };
    localStorage.setItem("bmb_user", JSON.stringify(u));
    setUser(u);
  };
  const logout = () => { localStorage.removeItem("bmb_user"); setUser(null); };

  return <AuthCtx.Provider value={{ user, login, logout, isAuthenticated: !!user }}>{children}</AuthCtx.Provider>;
}

// ─── Company Context ──────────────────────────────────────────────────────────
const CompanyCtx = createContext(null);
function useCompany() { return useContext(CompanyCtx); }

function CompanyProvider({ children }) {
  const { user } = useAuth();
  const [company, setCompany] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bmb_company") || "null"); } catch { return null; }
  });

  const updateCompany = (data) => {
    const updated = { ...company, ...data };
    localStorage.setItem("bmb_company", JSON.stringify(updated));
    setCompany(updated);
  };

  // Auto-create company on first login
  useEffect(() => {
    if (user && !company) {
      const defaultCompany = {
        id: genId(),
        companyName: user.companyName || "My Company",
        primaryColor: "#111827",
        secondaryColor: "#52FF00",
        logoUrl: "",
        userRole: "Owner",
      };
      localStorage.setItem("bmb_company", JSON.stringify(defaultCompany));
      setCompany(defaultCompany);
    }
  }, [user, company]);

  return <CompanyCtx.Provider value={{ company, updateCompany, companyId: company?.id }}>{children}</CompanyCtx.Provider>;
}

// ─── Router ───────────────────────────────────────────────────────────────────
const RouterCtx = createContext(null);
function useRouter() { return useContext(RouterCtx); }

function Router({ children }) {
  const [page, setPage] = useState("home");
  const [params, setParams] = useState({});
  const navigate = (to, p = {}) => { setPage(to); setParams(p); window.scrollTo(0, 0); };
  return <RouterCtx.Provider value={{ page, params, navigate }}>{children}</RouterCtx.Provider>;
}

// ─── Colors & Styles ──────────────────────────────────────────────────────────
const C = {
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  primary: "#111827",
  secondary: "#16A34A",
  accent: "#6366F1",
  destructive: "#EF4444",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  green: "#22C55E",
};

const inputCls = {
  width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 13, background: C.surface, color: C.text,
  outline: "none", boxSizing: "border-box",
};
const btnPrimary = {
  padding: "9px 18px", background: C.primary, color: "#fff", border: "none",
  borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const btnSecondary = {
  padding: "9px 18px", background: C.secondary, color: "#fff", border: "none",
  borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const btnOutline = {
  padding: "9px 18px", background: "transparent", color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
};
const btnDanger = {
  padding: "6px 12px", background: C.destructive, color: "#fff", border: "none",
  borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12,
};
const card = {
  background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
  padding: "20px", marginBottom: 16,
};

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Badge({ children, color = C.surfaceAlt, textColor = C.textMuted }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color, color: textColor }}>{children}</span>;
}

function StatusBadge({ status }) {
  const map = {
    Draft: [C.surfaceAlt, C.textMuted],
    Quote: ["#EFF6FF", "#2563EB"],
    Invoice: ["#FFF7ED", "#EA580C"],
    Paid: ["#F0FDF4", "#16A34A"],
    Cancelled: ["#FEF2F2", "#DC2626"],
    Active: ["#F0FDF4", "#16A34A"],
    Completed: ["#EFF6FF", "#2563EB"],
    Pending: ["#FEFCE8", "#CA8A04"],
    Accepted: ["#F0FDF4", "#16A34A"],
    Rejected: ["#FEF2F2", "#DC2626"],
    Sent: ["#EFF6FF", "#2563EB"],
  };
  const [bg, tx] = map[status] || [C.surfaceAlt, C.textMuted];
  return <Badge color={bg} textColor={tx}>{status || "Draft"}</Badge>;
}

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}{required && <span style={{ color: C.destructive }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", rows, style = {} }) {
  const s = { ...inputCls, ...style };
  return rows
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...s, resize: "vertical" }} />
    : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />;
}

function Select({ value, onChange, options, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputCls, ...style }}>
      {options.map(o => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 20px" }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: width, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.5px" }}>{title}</h1>
        {subtitle && <p style={{ color: C.textMuted, margin: "4px 0 0", fontSize: 14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: C.textMuted, marginBottom: 20 }}>{subtitle}</p>
      {action}
    </div>
  );
}

function DataTable({ columns, rows, onEdit, onDelete, onView, emptyMessage = "No data yet" }) {
  if (rows.length === 0) return <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>{emptyMessage}</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.surfaceAlt }}>
            {columns.map(c => <th key={c.key} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `2px solid ${C.border}` }}>{c.label}</th>)}
            {(onEdit || onDelete || onView) && <th style={{ width: 120, padding: "10px 12px", borderBottom: `2px solid ${C.border}` }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : "#FAFAFA" }}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: "10px 12px", color: C.text }}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                </td>
              ))}
              {(onEdit || onDelete || onView) && (
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {onView && <button onClick={() => onView(row)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12 }}>View</button>}
                    {onEdit && <button onClick={() => onEdit(row)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12 }}>Edit</button>}
                    {onDelete && <button onClick={() => onDelete(row)} style={{ ...btnDanger, padding: "4px 10px" }}>Del</button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "quotes", label: "Quotes & Invoices", icon: "📄" },
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "jobs", label: "Jobs", icon: "🏗️" },
  { id: "employees", label: "Employees", icon: "👤" },
  { id: "subcontractors", label: "Subcontractors", icon: "🔧" },
  { id: "time-entry", label: "Time Tracking", icon: "⏱️" },
  { id: "equipment", label: "Equipment", icon: "🚛" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "billing", label: "Billing & Reports", icon: "💰" },
  { id: "safety", label: "Safety Checks", icon: "🦺" },
  { id: "contracts", label: "Contracts", icon: "📋" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

function Sidebar() {
  const { page, navigate } = useRouter();
  const { company } = useCompany();
  const { logout, user } = useAuth();

  return (
    <aside style={{
      width: 220, minWidth: 220, background: C.primary, color: "#fff",
      display: "flex", flexDirection: "column", height: "100vh",
      position: "sticky", top: 0, flexShrink: 0, overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.secondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>B</div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>BuildMyBill</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", paddingLeft: 42 }}>{company?.companyName || "My Company"}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 8px" }}>
        {NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13, fontWeight: active ? 600 : 400,
                marginBottom: 2, textAlign: "left", transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
          {user?.name || user?.email || "User"}
        </div>
        <button onClick={logout} style={{ ...btnOutline, color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)", fontSize: 12, padding: "5px 10px", width: "100%" }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", companyName: "" });
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError("Email and password required."); return; }
    if (isRegister && !form.companyName) { setError("Company name required."); return; }
    login({ name: form.name || form.email.split("@")[0], email: form.email, companyName: form.companyName, role: "Owner" });
  };

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: C.secondary, fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 16 }}>B</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: 0 }}>BuildMyBill</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Business management for construction</p>
        </div>

        <div style={{ background: C.surface, borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>
            {isRegister ? "Create Account" : "Sign In"}
          </h2>
          {error && <div style={{ background: "#FEF2F2", color: C.destructive, padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            {isRegister && <>
              <Field label="Your Name"><TextInput value={form.name} onChange={f("name")} placeholder="Full name" /></Field>
              <Field label="Company Name" required><TextInput value={form.companyName} onChange={f("companyName")} placeholder="Acme Construction" /></Field>
            </>}
            <Field label="Email" required><TextInput type="email" value={form.email} onChange={f("email")} placeholder="you@company.com" /></Field>
            <Field label="Password" required><TextInput type="password" value={form.password} onChange={f("password")} placeholder="••••••••" /></Field>
            <button type="submit" style={{ ...btnSecondary, width: "100%", padding: "12px", marginTop: 8, fontSize: 15 }}>
              {isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textMuted }}>
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <button onClick={() => { setIsRegister(r => !r); setError(""); }}
              style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontWeight: 600 }}>
              {isRegister ? "Sign In" : "Create one"}
            </button>
          </p>
          <div style={{ marginTop: 20, padding: "12px 14px", background: C.surfaceAlt, borderRadius: 8, fontSize: 12, color: C.textMuted }}>
            💡 Demo: enter any email + password to get started
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { company } = useCompany();

  const stats = [
    { label: "Jobs", col: "jobs", icon: "🏗️", page: "jobs" },
    { label: "Clients", col: "clients", icon: "👥", page: "clients" },
    { label: "Quotes/Invoices", col: "quotes", icon: "📄", page: "quotes" },
    { label: "Employees", col: "employees", icon: "👤", page: "employees" },
    { label: "Equipment", col: "equipment", icon: "🚛", page: "equipment" },
    { label: "Time Entries", col: "timeentries", icon: "⏱️", page: "time-entry" },
  ].map(s => ({ ...s, count: db.getAll(s.col).total }));

  const recentQuotes = db.getAll("quotes", {}, { limit: 5 }).items;
  const recentJobs = db.getAll("jobs", {}, { limit: 5 }).items;

  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.name || "there"} 👋`} subtitle={company?.companyName} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} onClick={() => navigate(s.page)} style={{ ...card, cursor: "pointer", marginBottom: 0, textAlign: "center", transition: "box-shadow 0.2s" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{s.count}</div>
            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Recent Quotes
            <button onClick={() => navigate("quotes")} style={{ ...btnOutline, fontSize: 11, padding: "3px 10px" }}>View all</button>
          </h3>
          {recentQuotes.length === 0
            ? <p style={{ color: C.textMuted, fontSize: 13 }}>No quotes yet.</p>
            : recentQuotes.map(q => (
              <div key={q._id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{q.quoteId || "Quote"}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{q.clientReference || "—"}</div>
                </div>
                <StatusBadge status={q.status} />
              </div>
            ))}
        </div>

        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Recent Jobs
            <button onClick={() => navigate("jobs")} style={{ ...btnOutline, fontSize: 11, padding: "3px 10px" }}>View all</button>
          </h3>
          {recentJobs.length === 0
            ? <p style={{ color: C.textMuted, fontSize: 13 }}>No jobs yet.</p>
            : recentJobs.map(j => (
              <div key={j._id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{j.jobTitle || "Job"}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{j.clientName || "—"}</div>
                </div>
                <StatusBadge status={j.jobStatus} />
              </div>
            ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ ...card, marginTop: 0 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "New Quote", page: "quote-editor", icon: "📄" },
            { label: "New Job", page: "jobs", icon: "🏗️" },
            { label: "Log Time", page: "time-entry", icon: "⏱️" },
            { label: "Add Client", page: "clients", icon: "👥" },
            { label: "Add Employee", page: "employees", icon: "👤" },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.page)} style={{ ...btnOutline, display: "flex", alignItems: "center", gap: 6 }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Quote / Invoice Builder ──────────────────────────────────────────────────
const CURRENCIES = ["CAD", "USD", "GBP", "EUR", "AUD", "NZD", "ZAR"];
const STATUSES = ["Draft", "Quote", "Invoice", "Paid", "Cancelled"];
const TAX_PRESETS = [0, 5, 10, 12, 13, 15, 20];

function emptyItem() { return { id: genId(), description: "", unit: "", qty: 1, rate: 0, taxable: true }; }

function calcTotals(doc) {
  const subtotal = doc.items.reduce((s, it) => s + (it.qty * it.rate), 0);
  const taxable = doc.items.filter(i => i.taxable).reduce((s, it) => s + (it.qty * it.rate), 0);
  const discountAmt = doc.discountType === "percent" ? subtotal * (doc.discount / 100) : Number(doc.discount || 0);
  const afterDiscount = subtotal - discountAmt;
  const taxBase = subtotal > 0 ? taxable * (1 - discountAmt / subtotal) : 0;
  const taxAmt = taxBase * (doc.taxRate / 100);
  return { subtotal, discountAmt, taxAmt, total: afterDiscount + taxAmt };
}

function fmt(n, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, minimumFractionDigits: 2 }).format(n || 0);
}

function defaultDoc(company) {
  const d = new Date();
  const due = new Date(d); due.setDate(due.getDate() + 30);
  return {
    _id: genId(),
    quoteId: `INV-${d.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    status: "Invoice",
    currency: "CAD",
    issueDate: d.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    from: { name: company?.companyName || "", email: "", phone: "", address: "", logo: null },
    to: { name: "", email: "", phone: "", address: "" },
    items: [emptyItem()],
    taxRate: 0,
    taxLabel: "Tax",
    discount: 0,
    discountType: "percent",
    notes: "",
    terms: "Payment due within 30 days.",
    expirationDate: "",
    clientReference: "",
    jobReference: "",
    totalAmount: 0,
  };
}

function QuoteEditor({ docId, onClose }) {
  const { company } = useCompany();
  const [doc, setDoc] = useState(() => {
    if (docId) {
      const existing = db.getById("quotes", docId);
      if (existing) return existing;
    }
    return defaultDoc(company);
  });
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = patch => setDoc(d => ({ ...d, ...patch }));
  const updateFrom = patch => setDoc(d => ({ ...d, from: { ...d.from, ...patch } }));
  const updateTo = patch => setDoc(d => ({ ...d, to: { ...d.to, ...patch } }));
  const updateItems = items => setDoc(d => ({ ...d, items }));
  const updateItem = (id, field, val) => updateItems(doc.items.map(it => it.id === id ? { ...it, [field]: val } : it));

  const { subtotal, discountAmt, taxAmt, total } = calcTotals(doc);

  const handleSave = () => {
    const toSave = { ...doc, totalAmount: total, clientReference: doc.to.name, jobReference: doc.jobReference };
    if (docId) { db.update("quotes", toSave); } else { db.create("quotes", toSave); }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const handlePrint = () => {
    setPreview(true);
    setTimeout(() => window.print(), 400);
  };

  if (preview) return <PreviewModal doc={doc} subtotal={subtotal} discountAmt={discountAmt} taxAmt={taxAmt} total={total} onClose={() => setPreview(false)} />;

  const sectionTitle = (t) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 12, paddingBottom: 6, borderBottom: `2px solid ${C.accent}`, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t}</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Top Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onClose && <button onClick={onClose} style={{ ...btnOutline, fontSize: 12, padding: "5px 12px" }}>← Back</button>}
          <input value={doc.quoteId} onChange={e => update({ quoteId: e.target.value })} style={{ ...inputCls, width: 160, fontWeight: 700, fontSize: 15, border: "none", borderBottom: `2px solid ${C.border}` }} />
          <Select value={doc.status} onChange={v => update({ status: v })} options={STATUSES} style={{ width: 120 }} />
          <Select value={doc.currency} onChange={v => update({ currency: v })} options={CURRENCIES} style={{ width: 80 }} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saved && <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
          <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{fmt(total, doc.currency)}</span>
          <button onClick={handleSave} style={btnSecondary}>Save</button>
          <button onClick={() => setPreview(true)} style={btnPrimary}>Preview & Print</button>
        </div>
      </div>

      <div style={{ padding: "24px 24px", maxWidth: 960, margin: "0 auto" }}>
        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <Field label="Issue Date"><input type="date" value={doc.issueDate} onChange={e => update({ issueDate: e.target.value })} style={inputCls} /></Field>
          <Field label="Due Date"><input type="date" value={doc.dueDate} onChange={e => update({ dueDate: e.target.value })} style={inputCls} /></Field>
          <Field label="Expiry Date"><input type="date" value={doc.expirationDate} onChange={e => update({ expirationDate: e.target.value })} style={inputCls} /></Field>
        </div>

        {/* From / To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div style={{ ...card, marginBottom: 0 }}>
            {sectionTitle("From (Your Business)")}
            <LogoUpload logo={doc.from.logo} onChange={v => updateFrom({ logo: v })} />
            <Field label="Business Name"><TextInput value={doc.from.name} onChange={v => updateFrom({ name: v })} placeholder="Your Business" /></Field>
            <Field label="Email"><TextInput value={doc.from.email} onChange={v => updateFrom({ email: v })} placeholder="you@business.com" /></Field>
            <Field label="Phone"><TextInput value={doc.from.phone} onChange={v => updateFrom({ phone: v })} placeholder="+1 555 000 0000" /></Field>
            <Field label="Address"><TextInput value={doc.from.address} onChange={v => updateFrom({ address: v })} placeholder="123 Main St, City" rows={2} /></Field>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            {sectionTitle("Bill To")}
            <Field label="Client Name"><TextInput value={doc.to.name} onChange={v => updateTo({ name: v })} placeholder="Client Name" /></Field>
            <Field label="Email"><TextInput value={doc.to.email} onChange={v => updateTo({ email: v })} placeholder="client@email.com" /></Field>
            <Field label="Phone"><TextInput value={doc.to.phone} onChange={v => updateTo({ phone: v })} placeholder="+1 555 000 0000" /></Field>
            <Field label="Address"><TextInput value={doc.to.address} onChange={v => updateTo({ address: v })} placeholder="Client address" rows={2} /></Field>
          </div>
        </div>

        {/* Job Reference */}
        <div style={{ ...card, marginBottom: 20 }}>
          <Field label="Job / Project Reference">
            <TextInput value={doc.jobReference} onChange={v => update({ jobReference: v })} placeholder="Job name, number, or ID" />
          </Field>
        </div>

        {/* Line Items */}
        <div style={{ ...card, marginBottom: 20 }}>
          {sectionTitle("Line Items")}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["Description", "Unit", "Qty", "Rate", "Amount", "Tax?", ""].map((h, i) => (
                  <th key={i} style={{ padding: "8px 10px", textAlign: i >= 2 ? "right" : "left", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `2px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, i) => {
                const amt = item.qty * item.rate;
                return (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? C.surface : "#FAFAFA" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="Description…" style={{ ...inputCls, border: "none", background: "transparent" }} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} placeholder="hrs" style={{ ...inputCls, width: 60, border: "none", background: "transparent", textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input type="number" min="0" value={item.qty} onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)} style={{ ...inputCls, width: 70, border: "none", background: "transparent", textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} style={{ ...inputCls, width: 100, border: "none", background: "transparent", textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(amt, doc.currency)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>
                      <input type="checkbox" checked={item.taxable} onChange={e => updateItem(item.id, "taxable", e.target.checked)} style={{ accentColor: C.accent, cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>
                      {doc.items.length > 1 && <button onClick={() => updateItems(doc.items.filter(it => it.id !== item.id))} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={() => updateItems([...doc.items, emptyItem()])} style={{ marginTop: 12, padding: "7px 14px", background: "#EEF2FF", color: C.accent, border: `1px dashed #A5B4FC`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Add Line Item</button>
        </div>

        {/* Totals & Tax */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div style={{ width: 340, background: C.surfaceAlt, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}` }}>
            <TotalsBlock doc={doc} update={update} />
          </div>
        </div>

        {/* Notes / Terms */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            {sectionTitle("Notes")}
            <TextInput value={doc.notes} onChange={v => update({ notes: v })} placeholder="Payment instructions, thank-you note…" rows={4} />
          </div>
          <div style={card}>
            {sectionTitle("Terms & Conditions")}
            <TextInput value={doc.terms} onChange={v => update({ terms: v })} placeholder="Payment terms, late fees…" rows={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalsBlock({ doc, update }) {
  const { subtotal, discountAmt, taxAmt, total } = calcTotals(doc);
  const row = (label, value, bold) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: bold ? C.text : C.textMuted, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, color: bold ? C.accent : C.text, fontWeight: bold ? 700 : 500 }}>{fmt(value, doc.currency)}</span>
    </div>
  );
  return (
    <>
      {row("Subtotal", subtotal)}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>Discount</span>
        <input type="number" min="0" value={doc.discount} onChange={e => update({ discount: parseFloat(e.target.value) || 0 })} style={{ ...inputCls, width: 70, padding: "3px 6px", textAlign: "right" }} />
        <select value={doc.discountType} onChange={e => update({ discountType: e.target.value })} style={{ ...inputCls, width: 60, padding: "3px 6px" }}>
          <option value="percent">%</option>
          <option value="fixed">$</option>
        </select>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>−{fmt(discountAmt, doc.currency)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
        <input value={doc.taxLabel} onChange={e => update({ taxLabel: e.target.value })} style={{ ...inputCls, width: 60, padding: "3px 6px", fontSize: 11 }} placeholder="Tax" />
        <select value={doc.taxRate} onChange={e => update({ taxRate: parseFloat(e.target.value) })} style={{ ...inputCls, width: 80, padding: "3px 6px" }}>
          {TAX_PRESETS.map(t => <option key={t} value={t}>{t}%</option>)}
        </select>
        <input type="number" min="0" max="100" step="0.1" value={doc.taxRate} onChange={e => update({ taxRate: parseFloat(e.target.value) || 0 })} style={{ ...inputCls, width: 60, padding: "3px 6px" }} />
        <span style={{ fontSize: 12, color: C.text, fontWeight: 500, marginLeft: "auto" }}>{fmt(taxAmt, doc.currency)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Total Due</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{fmt(total, doc.currency)}</span>
      </div>
    </>
  );
}

function LogoUpload({ logo, onChange }) {
  const ref = useRef();
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      {logo
        ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={logo} alt="logo" style={{ height: 48, maxWidth: 140, objectFit: "contain", borderRadius: 6, border: `1px solid ${C.border}` }} />
            <button onClick={() => ref.current.click()} style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}>Change</button>
            <button onClick={() => onChange(null)} style={{ ...btnDanger, padding: "3px 8px", fontSize: 11 }}>Remove</button>
          </div>
        : <button onClick={() => ref.current.click()} style={{ padding: "8px 14px", border: `2px dashed ${C.border}`, borderRadius: 8, background: C.surfaceAlt, color: C.textMuted, cursor: "pointer", fontSize: 12 }}>+ Upload Logo</button>}
    </div>
  );
}

function PreviewModal({ doc, subtotal, discountAmt, taxAmt, total, onClose }) {
  const printStyle = `@media print { body * { visibility:hidden; } #print-area, #print-area * { visibility:visible; } #print-area { position:fixed; top:0; left:0; width:100%; } }`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 20px" }}>
      <style>{printStyle}</style>
      <div style={{ width: "100%", maxWidth: 760 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, justifyContent: "flex-end" }}>
          <button onClick={() => window.print()} style={btnSecondary}>🖨 Print / Save PDF</button>
          <button onClick={onClose} style={btnOutline}>Close</button>
        </div>
        <div id="print-area" style={{ background: "#fff", borderRadius: 12, padding: "48px 52px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "system-ui, sans-serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
            <div>
              {doc.from.logo && <img src={doc.from.logo} alt="logo" style={{ height: 60, maxWidth: 180, objectFit: "contain", marginBottom: 12 }} />}
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{doc.from.name || "Your Business"}</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {[doc.from.email, doc.from.phone, doc.from.address].filter(Boolean).join("\n")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", letterSpacing: "-1px", marginBottom: 6 }}>
                {doc.status === "Quote" ? "QUOTE" : "INVOICE"}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>{doc.quoteId}</div>
              <StatusBadge status={doc.status} />
            </div>
          </div>

          {/* Bill To / Dates */}
          <div style={{ display: "flex", gap: 32, marginBottom: 36, padding: "20px 24px", background: "#F8FAFC", borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Bill To</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{doc.to.name || "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {[doc.to.email, doc.to.phone, doc.to.address].filter(Boolean).join("\n")}
              </div>
            </div>
            <div style={{ minWidth: 140 }}>
              {doc.issueDate && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Issue Date</div><div style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{doc.issueDate}</div></div>}
              {doc.dueDate && <div><div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Due Date</div><div style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{doc.dueDate}</div></div>}
              {doc.jobReference && <div style={{ marginTop: 8 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Job Ref</div><div style={{ fontSize: 13, color: "#0F172A", fontWeight: 600 }}>{doc.jobReference}</div></div>}
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0F172A" }}>
                {["Description", "Unit", "Qty", "Rate", "Amount"].map((h, i) => (
                  <th key={h} style={{ padding: "10px 12px", color: "#E2E8F0", fontWeight: 600, fontSize: 11, textAlign: i >= 2 ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.items.filter(it => it.description || it.rate).map((it, i) => (
                <tr key={it.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                  <td style={{ padding: "10px 12px" }}>{it.description}</td>
                  <td style={{ padding: "10px 12px", color: "#64748B" }}>{it.unit}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{it.qty}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmt(it.rate, doc.currency)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(it.qty * it.rate, doc.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
            <div style={{ width: 260 }}>
              {[["Subtotal", subtotal], discountAmt > 0 && ["Discount", -discountAmt], doc.taxRate > 0 && [`${doc.taxLabel} (${doc.taxRate}%)`, taxAmt]].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#64748B", borderBottom: "1px solid #F1F5F9" }}>
                  <span>{l}</span><span style={{ color: "#1E293B" }}>{fmt(v, doc.currency)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Total Due</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{fmt(total, doc.currency)}</span>
              </div>
            </div>
          </div>

          {(doc.notes || doc.terms) && (
            <div style={{ display: "flex", gap: 24, paddingTop: 20, borderTop: "1px solid #E2E8F0" }}>
              {doc.notes && <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Notes</div><div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>{doc.notes}</div></div>}
              {doc.terms && <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Terms & Conditions</div><div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>{doc.terms}</div></div>}
            </div>
          )}
          <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#CBD5E1" }}>Generated with BuildMyBill</div>
        </div>
      </div>
    </div>
  );
}

// ─── Quotes List Page ─────────────────────────────────────────────────────────
function QuotesPage() {
  const { navigate } = useRouter();
  const [quotes, setQuotes] = useState(() => db.getAll("quotes").items);
  const [editing, setEditing] = useState(null); // null = list, string id = editor, "new" = new

  const reload = () => setQuotes(db.getAll("quotes").items);
  const del = (q) => { if (window.confirm("Delete this quote?")) { db.delete("quotes", q._id); reload(); } };

  if (editing !== null) return <QuoteEditor docId={editing === "new" ? null : editing} onClose={() => { setEditing(null); reload(); }} />;

  return (
    <div>
      <PageHeader
        title="Quotes & Invoices"
        subtitle="Create and manage quotes and invoices for your clients"
        action={<button onClick={() => setEditing("new")} style={btnSecondary}>+ New Quote</button>}
      />
      {quotes.length === 0
        ? <EmptyState icon="📄" title="No quotes yet" subtitle="Create your first quote to get started." action={<button onClick={() => setEditing("new")} style={btnSecondary}>Create Quote</button>} />
        : (
          <div style={card}>
            <DataTable
              columns={[
                { key: "quoteId", label: "ID" },
                { key: "status", label: "Status", render: v => <StatusBadge status={v} /> },
                { key: "clientReference", label: "Client" },
                { key: "jobReference", label: "Job Ref" },
                { key: "issueDate", label: "Date" },
                { key: "totalAmount", label: "Total", render: (v, row) => fmt(v || 0, row.currency) },
              ]}
              rows={quotes}
              onView={q => setEditing(q._id)}
              onEdit={q => setEditing(q._id)}
              onDelete={del}
            />
          </div>
        )}
    </div>
  );
}

// ─── Generic CRUD Page Factory ────────────────────────────────────────────────
function CRUDPage({ title, subtitle, collection, columns, formFields, emptyIcon, defaultValues = {} }) {
  const [items, setItems] = useState(() => db.getAll(collection).items);
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", data }

  const reload = () => setItems(db.getAll(collection).items);

  const save = (data) => {
    if (modal.mode === "edit") { db.update(collection, data); }
    else { db.create(collection, { ...data, _id: genId() }); }
    setModal(null); reload();
  };

  const del = (item) => {
    if (window.confirm(`Delete this ${title.slice(0, -1).toLowerCase()}?`)) {
      db.delete(collection, item._id); reload();
    }
  };

  const openCreate = () => setModal({ mode: "create", data: { _id: genId(), ...defaultValues } });
  const openEdit = (item) => setModal({ mode: "edit", data: { ...item } });

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={<button onClick={openCreate} style={btnSecondary}>+ New</button>}
      />
      {items.length === 0
        ? <EmptyState icon={emptyIcon || "📂"} title={`No ${title.toLowerCase()} yet`} subtitle="Create your first one to get started." action={<button onClick={openCreate} style={btnSecondary}>Create</button>} />
        : <div style={card}><DataTable columns={columns} rows={items} onEdit={openEdit} onDelete={del} /></div>}

      {modal && (
        <Modal title={modal.mode === "create" ? `New ${title.slice(0, -1)}` : `Edit ${title.slice(0, -1)}`} onClose={() => setModal(null)}>
          <CRUDForm fields={formFields} data={modal.data} onSave={save} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function CRUDForm({ fields, data, onSave, onCancel }) {
  const [form, setForm] = useState({ ...data });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      {fields.map(f => (
        <Field key={f.key} label={f.label} required={f.required}>
          {f.type === "select"
            ? <Select value={form[f.key] || ""} onChange={v => set(f.key, v)} options={f.options} />
            : f.type === "textarea"
            ? <TextInput value={form[f.key] || ""} onChange={v => set(f.key, v)} placeholder={f.placeholder} rows={3} />
            : <TextInput type={f.type || "text"} value={form[f.key] || ""} onChange={v => set(f.key, v)} placeholder={f.placeholder} />}
        </Field>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
        <button onClick={() => onSave(form)} style={{ ...btnSecondary, flex: 1 }}>Save</button>
      </div>
    </div>
  );
}

// ─── Clients Page ─────────────────────────────────────────────────────────────
function ClientsPage() {
  return <CRUDPage
    title="Clients" subtitle="Manage your client relationships" collection="clients" emptyIcon="👥"
    columns={[
      { key: "clientName", label: "Name" },
      { key: "contactPerson", label: "Contact" },
      { key: "emailAddress", label: "Email" },
      { key: "phoneNumber", label: "Phone" },
      { key: "billingAddress", label: "Address" },
    ]}
    formFields={[
      { key: "clientName", label: "Client / Business Name", required: true, placeholder: "Acme Corp" },
      { key: "contactPerson", label: "Contact Person", placeholder: "Jane Smith" },
      { key: "emailAddress", label: "Email", type: "email", placeholder: "jane@acme.com" },
      { key: "phoneNumber", label: "Phone", placeholder: "+1 555 000 0000" },
      { key: "billingAddress", label: "Billing Address", type: "textarea", placeholder: "123 Main St, City, Province" },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional notes…" },
    ]}
  />;
}

// ─── Jobs Page ────────────────────────────────────────────────────────────────
function JobsPage() {
  return <CRUDPage
    title="Jobs" subtitle="Manage construction projects and track progress" collection="jobs" emptyIcon="🏗️"
    defaultValues={{ jobStatus: "Pending" }}
    columns={[
      { key: "jobTitle", label: "Job Title" },
      { key: "clientName", label: "Client" },
      { key: "jobAddress", label: "Address" },
      { key: "startDate", label: "Start Date" },
      { key: "jobStatus", label: "Status", render: v => <StatusBadge status={v} /> },
    ]}
    formFields={[
      { key: "jobTitle", label: "Job Title", required: true, placeholder: "Site Renovation" },
      { key: "clientName", label: "Client", placeholder: "Client name" },
      { key: "jobAddress", label: "Job Address", placeholder: "Site address" },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "endDate", label: "End Date", type: "date" },
      { key: "jobStatus", label: "Status", type: "select", options: ["Pending", "Active", "In Progress", "Completed", "On Hold"] },
      { key: "jobDescription", label: "Description", type: "textarea", placeholder: "Project details…" },
    ]}
  />;
}

// ─── Employees Page ───────────────────────────────────────────────────────────
function EmployeesPage() {
  return <CRUDPage
    title="Employees" subtitle="Manage your team members" collection="employees" emptyIcon="👤"
    defaultValues={{ isActive: true }}
    columns={[
      { key: "fullName", label: "Name" },
      { key: "role", label: "Role" },
      { key: "email", label: "Email" },
      { key: "phoneNumber", label: "Phone" },
      { key: "hourlyRate", label: "Rate/hr", render: v => v ? `$${v}` : "—" },
      { key: "isActive", label: "Active", render: v => v ? "✅" : "❌" },
    ]}
    formFields={[
      { key: "fullName", label: "Full Name", required: true, placeholder: "John Doe" },
      { key: "employeeId", label: "Employee ID", placeholder: "EMP001" },
      { key: "role", label: "Role", placeholder: "Operator, Supervisor…" },
      { key: "email", label: "Email", type: "email", placeholder: "john@company.com" },
      { key: "phoneNumber", label: "Phone", placeholder: "+1 555 000 0000" },
      { key: "hourlyRate", label: "Hourly Rate ($)", type: "number", placeholder: "25.00" },
      { key: "startDate", label: "Start Date", type: "date" },
    ]}
  />;
}

// ─── Subcontractors Page ──────────────────────────────────────────────────────
function SubcontractorsPage() {
  return <CRUDPage
    title="Subcontractors" subtitle="Manage your external contractor network" collection="subcontractors" emptyIcon="🔧"
    columns={[
      { key: "subcontractorName", label: "Company" },
      { key: "contactPerson", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "phoneNumber", label: "Phone" },
      { key: "hourlyRate", label: "Rate/hr", render: v => v ? `$${v}` : "—" },
      { key: "specialties", label: "Specialties" },
    ]}
    formFields={[
      { key: "subcontractorName", label: "Company Name", required: true, placeholder: "ABC Electrical" },
      { key: "contactPerson", label: "Contact Person", placeholder: "Jane Doe" },
      { key: "email", label: "Email", type: "email", placeholder: "contact@abc.com" },
      { key: "phoneNumber", label: "Phone", placeholder: "+1 555 000 0000" },
      { key: "address", label: "Address", placeholder: "Street address" },
      { key: "hourlyRate", label: "Hourly Rate ($)", type: "number", placeholder: "75.00" },
      { key: "specialties", label: "Specialties", placeholder: "Electrical, Plumbing, HVAC…" },
      { key: "descriptionOfServices", label: "Description", type: "textarea", placeholder: "Services offered…" },
    ]}
  />;
}

// ─── Equipment Page ───────────────────────────────────────────────────────────
function EquipmentPage() {
  return <CRUDPage
    title="Equipment" subtitle="Track your fleet and machinery" collection="equipment" emptyIcon="🚛"
    columns={[
      { key: "equipmentName", label: "Name" },
      { key: "manufacturer", label: "Manufacturer" },
      { key: "yearOfManufacture", label: "Year" },
      { key: "billingRatePerHour", label: "$/hr", render: v => v ? `$${v}` : "—" },
      { key: "totalHours", label: "Hours/KM" },
      { key: "vinNumber", label: "VIN" },
    ]}
    formFields={[
      { key: "equipmentName", label: "Equipment Name", required: true, placeholder: "Excavator CAT 320" },
      { key: "equipmentType", label: "Type", type: "select", options: ["semi", "truck", "wheelLoader", "excavator", "bulldozer", "crane", "other"] },
      { key: "manufacturer", label: "Manufacturer", placeholder: "Caterpillar, John Deere…" },
      { key: "yearOfManufacture", label: "Year", type: "number", placeholder: "2020" },
      { key: "billingRatePerHour", label: "Billing Rate ($/hr)", type: "number", placeholder: "150.00" },
      { key: "totalHours", label: "Total Hours / KM", type: "number", placeholder: "0" },
      { key: "vinNumber", label: "VIN Number", placeholder: "1HGBH41JXMN109186" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Equipment notes…" },
      { key: "maintenanceNotes", label: "Maintenance Notes", type: "textarea", placeholder: "Recent maintenance…" },
    ]}
  />;
}

// ─── Inventory Page ───────────────────────────────────────────────────────────
function InventoryPage() {
  return <CRUDPage
    title="Inventory" subtitle="Track stock levels and materials" collection="inventory" emptyIcon="📦"
    columns={[
      { key: "materialName", label: "Material" },
      { key: "currentStock", label: "Stock", render: (v, row) => `${v || 0} ${row.unitOfMeasure || "units"}` },
      { key: "unitPrice", label: "Unit Price", render: v => v ? `$${v}` : "—" },
      { key: "supplier", label: "Supplier" },
    ]}
    formFields={[
      { key: "materialName", label: "Material Name", required: true, placeholder: "Gravel, Sand, Lumber…" },
      { key: "currentStock", label: "Current Stock", type: "number", placeholder: "100" },
      { key: "unitOfMeasure", label: "Unit of Measure", placeholder: "tons, yards, units…" },
      { key: "unitPrice", label: "Unit Price ($)", type: "number", placeholder: "25.00" },
      { key: "supplier", label: "Supplier", placeholder: "Supplier name" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Material details…" },
    ]}
  />;
}

// ─── Time Entry Page ──────────────────────────────────────────────────────────
function TimeEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([{ id: genId(), jobLocation: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]);
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState(() => db.getAll("timeentries", {}, { limit: 20 }).items);

  const addRow = () => setRows(r => [...r, { id: genId(), jobLocation: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]);
  const updRow = (id, k, v) => setRows(r => r.map(x => x.id === id ? { ...x, [k]: v } : x));
  const delRow = (id) => setRows(r => r.filter(x => x.id !== id));

  const calcHours = (s, e) => {
    if (!s || !e) return 0;
    const [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number);
    return (eh * 60 + em - sh * 60 - sm) / 60;
  };
  const totalHours = rows.reduce((t, r) => t + calcHours(r.startTime, r.endTime), 0);

  const submit = () => {
    rows.forEach(r => {
      if (r.jobLocation || r.workDone) {
        db.create("timeentries", {
          employeeName: user?.name || "Unknown",
          jobName: r.jobLocation,
          entryDate: date,
          hoursWorked: calcHours(r.startTime, r.endTime),
          workDescription: `${r.startTime}–${r.endTime}: ${r.workDone}${r.notes ? `\nNotes: ${r.notes}` : ""}`,
          equipmentUsed: r.equipment,
          mileageDriven: 0,
        });
      }
    });
    setSuccess(true);
    setRows([{ id: genId(), jobLocation: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]);
    setEntries(db.getAll("timeentries", {}, { limit: 20 }).items);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div>
      <PageHeader title="Time Tracking" subtitle="Log your daily work hours and activities" />
      {success && <div style={{ background: "#F0FDF4", color: "#16A34A", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>✓ Time entries submitted!</div>}

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputCls} /></Field>
          <div style={{ fontSize: 14, color: C.textMuted }}>Total: <strong style={{ color: C.accent }}>{totalHours.toFixed(2)} hrs</strong></div>
          <div style={{ fontSize: 14, color: C.textMuted }}>{rows.length}/10 entries</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["Job / Location", "Work Done", "Start", "End", "Hrs", "Equipment", "Notes", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `2px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? C.surface : "#FAFAFA", borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 8px" }}><input value={r.jobLocation} onChange={e => updRow(r.id, "jobLocation", e.target.value)} placeholder="Site A" style={{ ...inputCls, minWidth: 120 }} /></td>
                  <td style={{ padding: "6px 8px" }}><input value={r.workDone} onChange={e => updRow(r.id, "workDone", e.target.value)} placeholder="Excavation…" style={{ ...inputCls, minWidth: 140 }} /></td>
                  <td style={{ padding: "6px 4px" }}><input type="time" value={r.startTime} onChange={e => updRow(r.id, "startTime", e.target.value)} style={{ ...inputCls, width: 90 }} /></td>
                  <td style={{ padding: "6px 4px" }}><input type="time" value={r.endTime} onChange={e => updRow(r.id, "endTime", e.target.value)} style={{ ...inputCls, width: 90 }} /></td>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: C.accent }}>{calcHours(r.startTime, r.endTime).toFixed(1)}h</td>
                  <td style={{ padding: "6px 4px" }}><input value={r.equipment} onChange={e => updRow(r.id, "equipment", e.target.value)} placeholder="None" style={{ ...inputCls, width: 100 }} /></td>
                  <td style={{ padding: "6px 4px" }}><input value={r.notes} onChange={e => updRow(r.id, "notes", e.target.value)} placeholder="Notes…" style={{ ...inputCls, minWidth: 100 }} /></td>
                  <td style={{ padding: "6px 4px" }}>{rows.length > 1 && <button onClick={() => delRow(r.id)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          {rows.length < 10 && <button onClick={addRow} style={btnOutline}>+ Add Row</button>}
          <button onClick={submit} style={btnSecondary}>Submit Time Entries</button>
        </div>
      </div>

      {/* Recent Entries */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recent Entries</h3>
        {entries.length === 0
          ? <p style={{ color: C.textMuted, fontSize: 13 }}>No entries yet.</p>
          : <DataTable
              columns={[
                { key: "entryDate", label: "Date" },
                { key: "employeeName", label: "Employee" },
                { key: "jobName", label: "Job" },
                { key: "hoursWorked", label: "Hours", render: v => `${(v || 0).toFixed(2)}h` },
                { key: "equipmentUsed", label: "Equipment" },
              ]}
              rows={entries}
              onDelete={e => { if (window.confirm("Delete this entry?")) { db.delete("timeentries", e._id); setEntries(db.getAll("timeentries", {}, { limit: 20 }).items); } }}
            />}
      </div>
    </div>
  );
}

// ─── Billing Report Page ──────────────────────────────────────────────────────
function BillingPage() {
  const [entries, setEntries] = useState(() => db.getAll("timeentries", {}, { limit: 500 }).items);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", employee: "" });

  const filtered = entries.filter(e => {
    if (filters.startDate && e.entryDate < filters.startDate) return false;
    if (filters.endDate && e.entryDate > filters.endDate) return false;
    if (filters.employee && !e.employeeName?.toLowerCase().includes(filters.employee.toLowerCase())) return false;
    return true;
  });

  const totalHours = filtered.reduce((s, e) => s + (e.hoursWorked || 0), 0);

  const exportCSV = () => {
    const rows = [
      ["Date", "Employee", "Job", "Hours", "Equipment", "Description"],
      ...filtered.map(e => [e.entryDate, e.employeeName, e.jobName, e.hoursWorked, e.equipmentUsed, e.workDescription]),
      ["", "", "TOTAL", totalHours.toFixed(2)],
    ];
    const csv = rows.map(r => r.map(c => `"${c || ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `billing_report_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader title="Billing & Reports" subtitle="Generate billing reports from time entries" action={<button onClick={exportCSV} style={btnSecondary}>📊 Export CSV</button>} />

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Start Date"><input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} style={inputCls} /></Field>
          <Field label="End Date"><input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} style={inputCls} /></Field>
          <Field label="Employee"><TextInput value={filters.employee} onChange={v => setFilters(f => ({ ...f, employee: v }))} placeholder="Filter by employee…" /></Field>
          <button onClick={() => setFilters({ startDate: "", endDate: "", employee: "" })} style={btnOutline}>Clear</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total Hours", value: totalHours.toFixed(2), suffix: "hrs" },
          { label: "Entries", value: filtered.length, suffix: "entries" },
          { label: "Unique Jobs", value: new Set(filtered.map(e => e.jobName)).size, suffix: "jobs" },
        ].map(s => (
          <div key={s.label} style={{ ...card, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{s.value}</div>
            <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        {filtered.length === 0
          ? <p style={{ color: C.textMuted, textAlign: "center", padding: 24 }}>No entries match your filters.</p>
          : <DataTable
              columns={[
                { key: "entryDate", label: "Date" },
                { key: "employeeName", label: "Employee" },
                { key: "jobName", label: "Job" },
                { key: "hoursWorked", label: "Hours", render: v => `${(v || 0).toFixed(2)}h` },
                { key: "equipmentUsed", label: "Equipment" },
              ]}
              rows={filtered}
            />}
      </div>
    </div>
  );
}

// ─── Schedule Page ────────────────────────────────────────────────────────────
function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobs] = useState(() => db.getAll("jobs", {}, { limit: 200 }).items);

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const days = [];
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const jobsForDay = (day) => jobs.filter(j => {
    if (!j.startDate) return false;
    const jd = new Date(j.startDate).toDateString();
    return jd === day.toDateString();
  });

  const prev = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div>
      <PageHeader title="Schedule" subtitle="View jobs scheduled on the calendar" />
      <div style={{ ...card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={prev} style={btnOutline}>← Previous</button>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{currentDate.toLocaleString("default", { month: "long", year: "numeric" })}</h2>
          <button onClick={next} style={btnOutline}>Next →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: C.textMuted, padding: "8px 4px", textTransform: "uppercase" }}>{d}</div>
          ))}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const dayJobs = jobsForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div key={day.toISOString()} style={{ minHeight: 80, background: isToday ? "#EEF2FF" : C.surfaceAlt, borderRadius: 8, padding: 6, border: isToday ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? C.accent : C.textMuted, marginBottom: 4 }}>{day.getDate()}</div>
                {dayJobs.slice(0, 2).map(j => (
                  <div key={j._id} style={{ background: C.primary, color: "#fff", borderRadius: 4, padding: "2px 5px", fontSize: 10, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.jobTitle}
                  </div>
                ))}
                {dayJobs.length > 2 && <div style={{ fontSize: 10, color: C.textMuted }}>+{dayJobs.length - 2}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Safety Checks Page ───────────────────────────────────────────────────────
function SafetyPage() {
  return <CRUDPage
    title="Safety Checks" subtitle="Manage safety check templates and submissions" collection="safetychecks" emptyIcon="🦺"
    columns={[
      { key: "templateName", label: "Template" },
      { key: "equipmentCategory", label: "Equipment Category" },
      { key: "createdBy", label: "Created By" },
      { key: "passFailStatus", label: "Status", render: v => v ? <Badge color="#F0FDF4" textColor="#16A34A">Pass</Badge> : <Badge color="#FEF2F2" textColor="#DC2626">Fail</Badge> },
    ]}
    formFields={[
      { key: "templateName", label: "Template Name", required: true, placeholder: "Daily Equipment Inspection" },
      { key: "equipmentCategory", label: "Equipment Category", placeholder: "Excavator, Truck…" },
      { key: "checklistQuestions", label: "Checklist Items", type: "textarea", placeholder: "Brakes\nLights\nFluids\nTires" },
      { key: "createdBy", label: "Created By", placeholder: "Your name" },
      { key: "passFailStatus", label: "Pass/Fail Status", type: "select", options: [{ value: true, label: "Pass" }, { value: false, label: "Fail" }] },
    ]}
  />;
}

// ─── Contracts Page ───────────────────────────────────────────────────────────
function ContractsPage() {
  return <CRUDPage
    title="Contracts" subtitle="Manage construction contracts" collection="contracts" emptyIcon="📋"
    defaultValues={{ status: "Active" }}
    columns={[
      { key: "contractName", label: "Contract Name" },
      { key: "clientReference", label: "Client" },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "status", label: "Status", render: v => <StatusBadge status={v} /> },
    ]}
    formFields={[
      { key: "contractName", label: "Contract Name", required: true, placeholder: "Downtown Office Building" },
      { key: "clientReference", label: "Client Reference", required: true, placeholder: "Client name or ID" },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "endDate", label: "End Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Pending", "Completed", "On Hold"] },
      { key: "description", label: "Description", type: "textarea", placeholder: "Contract scope and details…" },
    ]}
  />;
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const { company, updateCompany } = useCompany();
  const { user } = useAuth();
  const [form, setForm] = useState({
    companyName: company?.companyName || "",
    primaryColor: company?.primaryColor || "#111827",
    secondaryColor: company?.secondaryColor || "#52FF00",
    logoUrl: company?.logoUrl || "",
  });
  const [saved, setSaved] = useState(false);

  const save = () => { updateCompany(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your company and account settings" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Company Branding</h3>
          <Field label="Company Name"><TextInput value={form.companyName} onChange={v => setForm(f => ({ ...f, companyName: v }))} placeholder="My Construction Company" /></Field>
          <Field label="Logo URL"><TextInput value={form.logoUrl} onChange={v => setForm(f => ({ ...f, logoUrl: v }))} placeholder="https://…" /></Field>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <Field label="Primary Color">
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} style={{ width: 48, height: 38, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}` }} />
                <TextInput value={form.primaryColor} onChange={v => setForm(f => ({ ...f, primaryColor: v }))} style={{ fontFamily: "monospace" }} />
              </div>
            </Field>
            <Field label="Secondary Color">
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" value={form.secondaryColor} onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))} style={{ width: 48, height: 38, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}` }} />
                <TextInput value={form.secondaryColor} onChange={v => setForm(f => ({ ...f, secondaryColor: v }))} style={{ fontFamily: "monospace" }} />
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={save} style={btnSecondary}>Save Settings</button>
            {saved && <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>✓ Saved!</span>}
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Account Information</h3>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Name</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name || "—"}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 14 }}>{user?.email || "—"}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Role</div>
            <Badge color="#EEF2FF" textColor={C.accent}>{user?.role || "Owner"}</Badge>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Subscription</div>
            <Badge color="#F0FDF4" textColor="#16A34A">Active</Badge>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Data Management</h3>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>All data is stored locally in your browser. Export to back it up.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => {
            const data = {};
            ["quotes", "clients", "jobs", "employees", "equipment", "inventory", "timeentries", "subcontractors", "contracts", "safetychecks"].forEach(c => { data[c] = getCol(c); });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = `buildmybill_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
          }} style={btnOutline}>📤 Export All Data</button>
        </div>
      </div>
    </div>
  );
}

// Expose getCol for settings export
function getCol(name) {
  try { return JSON.parse(localStorage.getItem(`bmb_${name}`) || "[]"); } catch { return []; }
}

// ─── App Shell ────────────────────────────────────────────────────────────────
function AppShell() {
  const { page } = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  const pages = {
    dashboard: <Dashboard />,
    quotes: <QuotesPage />,
    "quote-editor": <QuotesPage />,
    clients: <ClientsPage />,
    jobs: <JobsPage />,
    employees: <EmployeesPage />,
    subcontractors: <SubcontractorsPage />,
    "time-entry": <TimeEntryPage />,
    equipment: <EquipmentPage />,
    inventory: <InventoryPage />,
    schedule: <SchedulePage />,
    billing: <BillingPage />,
    safety: <SafetyPage />,
    contracts: <ContractsPage />,
    settings: <SettingsPage />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto", minWidth: 0 }}>
        {pages[page] || <Dashboard />}
      </main>
    </div>
  );
}

// ─── Truck Log Books Page ─────────────────────────────────────────────────────
function TruckLogBooksPage() {
  const [logs, setLogs] = useState(() => db.getAll("trucklogbooks").items);
  const [modal, setModal] = useState(null);

  const reload = () => setLogs(db.getAll("trucklogbooks").items);

  const defaultForm = { vehicleIdentifier: "", employeeName: "", brakesChecked: false, lightsChecked: false, fluidsChecked: false, odometerReading: "" };

  const save = (data) => {
    const overall = data.brakesChecked && data.lightsChecked && data.fluidsChecked;
    const record = { ...data, overallStatus: overall, logDateTime: modal.mode === "edit" ? data.logDateTime : new Date().toISOString() };
    if (modal.mode === "edit") db.update("trucklogbooks", record);
    else db.create("trucklogbooks", { ...record, _id: genId() });
    setModal(null); reload();
  };

  const del = (item) => { if (window.confirm("Delete this log?")) { db.delete("trucklogbooks", item._id); reload(); } };

  return (
    <div>
      <PageHeader title="Vehicle Log Books" subtitle="Daily morning safety checklists for vehicles and equipment"
        action={<button onClick={() => setModal({ mode: "create", data: { _id: genId(), ...defaultForm } })} style={btnSecondary}>+ New Log</button>} />
      {logs.length === 0
        ? <EmptyState icon="🚛" title="No vehicle logs yet" subtitle="Create daily safety checklists for your fleet." action={<button onClick={() => setModal({ mode: "create", data: { _id: genId(), ...defaultForm } })} style={btnSecondary}>Create Log</button>} />
        : <div style={card}><DataTable
            columns={[
              { key: "vehicleIdentifier", label: "Vehicle" },
              { key: "employeeName", label: "Employee" },
              { key: "logDateTime", label: "Date/Time", render: v => v ? new Date(v).toLocaleString() : "—" },
              { key: "odometerReading", label: "Odometer", render: v => v ? `${v} mi` : "—" },
              { key: "brakesChecked", label: "Brakes", render: v => v ? "✅" : "❌" },
              { key: "lightsChecked", label: "Lights", render: v => v ? "✅" : "❌" },
              { key: "fluidsChecked", label: "Fluids", render: v => v ? "✅" : "❌" },
              { key: "overallStatus", label: "Status", render: v => v ? <Badge color="#F0FDF4" textColor="#16A34A">Pass</Badge> : <Badge color="#FEF2F2" textColor="#DC2626">Fail</Badge> },
            ]}
            rows={logs} onEdit={item => setModal({ mode: "edit", data: { ...item } })} onDelete={del}
          /></div>}
      {modal && (
        <Modal title={modal.mode === "create" ? "New Vehicle Log" : "Edit Vehicle Log"} onClose={() => setModal(null)}>
          <TruckLogForm data={modal.data} onSave={save} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function TruckLogForm({ data, onSave, onCancel }) {
  const [form, setForm] = useState({ ...data });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const overall = form.brakesChecked && form.lightsChecked && form.fluidsChecked;
  return (
    <div>
      <Field label="Vehicle ID / Name" required><TextInput value={form.vehicleIdentifier || ""} onChange={v => set("vehicleIdentifier", v)} placeholder="Truck 01, Excavator A…" /></Field>
      <Field label="Employee Name" required><TextInput value={form.employeeName || ""} onChange={v => set("employeeName", v)} placeholder="John Doe" /></Field>
      <Field label="Odometer Reading"><TextInput type="number" value={form.odometerReading || ""} onChange={v => set("odometerReading", v)} placeholder="0" /></Field>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Safety Checks</label>
        {[["brakesChecked", "✅ Brakes checked and operational"], ["lightsChecked", "✅ Lights checked and operational"], ["fluidsChecked", "✅ Fluid levels checked and adequate"]].map(([k, l]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: form[k] ? "#F0FDF4" : C.surfaceAlt, borderRadius: 8, marginBottom: 8, cursor: "pointer", border: `1px solid ${form[k] ? "#BBF7D0" : C.border}` }}>
            <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} style={{ accentColor: C.green, width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span>
          </label>
        ))}
      </div>
      <div style={{ padding: "10px 14px", background: overall ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, marginBottom: 16, textAlign: "center", fontWeight: 700, color: overall ? "#16A34A" : "#DC2626" }}>
        Overall Status: {overall ? "✅ PASS" : "❌ FAIL"}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
        <button onClick={() => onSave(form)} style={{ ...btnSecondary, flex: 1 }}>Save</button>
      </div>
    </div>
  );
}

// ─── Warehouses Page ──────────────────────────────────────────────────────────
function WarehousesPage() {
  return <CRUDPage
    title="Warehouses" subtitle="Manage storage locations and track inventory by facility" collection="warehouses" emptyIcon="🏭"
    defaultValues={{ isActive: true }}
    columns={[
      { key: "warehouseName", label: "Warehouse Name" },
      { key: "address", label: "Address" },
      { key: "contactPerson", label: "Contact" },
      { key: "phoneNumber", label: "Phone" },
      { key: "capacity", label: "Capacity (sq ft)", render: v => v ? `${v.toLocaleString()} sq ft` : "—" },
      { key: "isActive", label: "Active", render: v => v !== false ? "✅" : "❌" },
    ]}
    formFields={[
      { key: "warehouseName", label: "Warehouse Name", required: true, placeholder: "Main Warehouse" },
      { key: "address", label: "Address", required: true, placeholder: "123 Industrial Blvd, City" },
      { key: "contactPerson", label: "Contact Person", placeholder: "John Doe" },
      { key: "phoneNumber", label: "Phone Number", placeholder: "+1 555 000 0000" },
      { key: "capacity", label: "Capacity (sq ft)", type: "number", placeholder: "10000" },
    ]}
  />;
}

// ─── Manager Logs Page ────────────────────────────────────────────────────────
function ManagerLogsPage() {
  return <CRUDPage
    title="Manager Logs" subtitle="Track daily management activities and oversight updates" collection="managerlogs" emptyIcon="📋"
    defaultValues={{ status: "Pending" }}
    columns={[
      { key: "managerName", label: "Manager" },
      { key: "logDate", label: "Date", render: v => v ? new Date(v).toLocaleDateString() : "—" },
      { key: "logTime", label: "Time" },
      { key: "activityDescription", label: "Activity", render: v => v ? v.slice(0, 60) + (v.length > 60 ? "…" : "") : "—" },
      { key: "status", label: "Status", render: v => <StatusBadge status={v} /> },
    ]}
    formFields={[
      { key: "managerName", label: "Manager Name", required: true, placeholder: "Your name" },
      { key: "logDate", label: "Log Date", type: "date" },
      { key: "logTime", label: "Log Time", type: "time" },
      { key: "activityDescription", label: "Activity Description", type: "textarea", placeholder: "Describe the day's management activities…" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "In Progress", "Completed", "On Hold"] },
    ]}
  />;
}

// ─── Daily Log Page ───────────────────────────────────────────────────────────
function DailyLogPage() {
  const { user } = useAuth();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([{ id: genId(), jobLocation: "", contract: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]);
  const [success, setSuccess] = useState(false);
  const [jobs] = useState(() => db.getAll("jobs").items);
  const [contracts] = useState(() => db.getAll("contracts").items);
  const [equipment] = useState(() => db.getAll("equipment").items);

  const addRow = () => { if (rows.length < 30) setRows(r => [...r, { id: genId(), jobLocation: "", contract: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]); };
  const updRow = (id, k, v) => setRows(r => r.map(x => x.id === id ? { ...x, [k]: v } : x));
  const delRow = (id) => setRows(r => r.filter(x => x.id !== id));

  const calcHours = (s, e) => {
    if (!s || !e) return 0;
    const [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  };
  const totalHours = rows.reduce((t, r) => t + calcHours(r.startTime, r.endTime), 0);

  const submit = () => {
    rows.forEach(r => {
      if (r.jobLocation || r.workDone) {
        db.create("timeentries", {
          employeeName: user?.name || "Unknown",
          jobName: r.jobLocation,
          entryDate: entryDate,
          hoursWorked: calcHours(r.startTime, r.endTime),
          workDescription: `${r.startTime}–${r.endTime}: ${r.workDone}${r.notes ? `\nNotes: ${r.notes}` : ""}`,
          equipmentUsed: r.equipment,
          mileageDriven: 0,
        });
      }
    });
    setSuccess(true);
    setRows([{ id: genId(), jobLocation: "", contract: "", workDone: "", startTime: "08:00", endTime: "17:00", equipment: "", notes: "" }]);
    setTimeout(() => setSuccess(false), 3000);
  };

  const exportCSV = () => {
    const headers = ["Job Location", "Contract", "Work Done", "Start", "End", "Hours", "Equipment", "Notes"];
    const csvRows = rows.map(r => [r.jobLocation, r.contract, r.workDone, r.startTime, r.endTime, calcHours(r.startTime, r.endTime).toFixed(2), r.equipment, r.notes]);
    const csv = [`Date: ${entryDate}`, `Employee: ${user?.name}`, "", headers.join(","), ...csvRows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `daily_log_${entryDate}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader title="Daily Log" subtitle="Record daily work activities, hours, and equipment usage" />
      {success && <div style={{ background: "#F0FDF4", color: "#16A34A", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>✓ Daily log submitted successfully!</div>}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
          <Field label="Date"><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={inputCls} /></Field>
          <div style={{ fontSize: 14, color: C.textMuted }}>Total: <strong style={{ color: C.accent }}>{totalHours.toFixed(2)} hrs</strong></div>
          <div style={{ fontSize: 14, color: C.textMuted }}>{rows.length}/30 entries</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.id} style={{ background: C.surfaceAlt, borderRadius: 10, padding: 16, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
              <Field label="Job Location">
                <select value={r.jobLocation} onChange={e => updRow(r.id, "jobLocation", e.target.value)} style={inputCls}>
                  <option value="">Select job…</option>
                  {jobs.map(j => <option key={j._id} value={j.jobAddress || j.jobTitle || ""}>{j.jobAddress || j.jobTitle}</option>)}
                </select>
              </Field>
              <Field label="Contract">
                <select value={r.contract} onChange={e => updRow(r.id, "contract", e.target.value)} style={inputCls}>
                  <option value="">Select contract…</option>
                  {contracts.map(c => <option key={c._id} value={c.contractName || ""}>{c.contractName}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 120px 80px 1fr", gap: 12, marginBottom: 10 }}>
              <Field label="Start Time"><input type="time" value={r.startTime} onChange={e => updRow(r.id, "startTime", e.target.value)} style={inputCls} /></Field>
              <Field label="End Time"><input type="time" value={r.endTime} onChange={e => updRow(r.id, "endTime", e.target.value)} style={inputCls} /></Field>
              <Field label="Hours"><div style={{ ...inputCls, textAlign: "center", fontWeight: 700, color: C.accent, background: C.surfaceAlt }}>{calcHours(r.startTime, r.endTime).toFixed(1)}h</div></Field>
              <Field label="Equipment">
                <select value={r.equipment} onChange={e => updRow(r.id, "equipment", e.target.value)} style={inputCls}>
                  <option value="">No equipment</option>
                  {equipment.map(eq => <option key={eq._id} value={eq.equipmentName || ""}>{eq.equipmentName}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Work Done"><TextInput value={r.workDone} onChange={v => updRow(r.id, "workDone", v)} placeholder="Excavation, foundation work…" rows={2} /></Field>
              <Field label="Notes"><TextInput value={r.notes} onChange={v => updRow(r.id, "notes", v)} placeholder="Additional notes…" rows={2} /></Field>
            </div>
            {rows.length > 1 && <button onClick={() => delRow(r.id)} style={{ ...btnDanger, marginTop: 8, fontSize: 11 }}>Remove Row</button>}
          </div>
        ))}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          {rows.length < 30 && <button onClick={addRow} style={btnOutline}>+ Add Row</button>}
          <button onClick={exportCSV} style={btnOutline}>📊 Export CSV</button>
          <button onClick={submit} style={btnSecondary}>Submit Daily Log</button>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Logs Page ───────────────────────────────────────────────────────
function EmployeeLogsPage() {
  const [entries] = useState(() => db.getAll("timeentries", {}, { limit: 500 }).items);
  const [employees] = useState(() => db.getAll("employees").items);
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const filtered = entries.filter(e => !selectedEmployee || e.employeeName === selectedEmployee);

  const byEmployee = filtered.reduce((acc, e) => {
    const n = e.employeeName || "Unknown";
    if (!acc[n]) acc[n] = { hours: 0, miles: 0, entries: 0 };
    acc[n].hours += e.hoursWorked || 0;
    acc[n].miles += e.mileageDriven || 0;
    acc[n].entries++;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Work Logs" subtitle="Real-time insights into employee productivity and hours tracked" />
      <div style={{ ...card, marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end" }}>
        <Field label="Filter by Employee">
          <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} style={{ ...inputCls, width: 220 }}>
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp.fullName}>{emp.fullName}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {Object.entries(byEmployee).map(([name, stats]) => (
          <div key={name} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.text }}>{name}</div>
            {[
              { label: "Hours Worked", value: `${stats.hours.toFixed(2)}h` },
              { label: "Miles Driven", value: `${stats.miles.toFixed(2)} mi` },
              { label: "Log Entries", value: stats.entries },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{s.value}</span>
              </div>
            ))}
          </div>
        ))}
        {Object.keys(byEmployee).length === 0 && <p style={{ color: C.textMuted, gridColumn: "1/-1" }}>No time entries found.</p>}
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>All Time Entries</h3>
        <DataTable
          columns={[
            { key: "entryDate", label: "Date" },
            { key: "employeeName", label: "Employee" },
            { key: "jobName", label: "Job" },
            { key: "hoursWorked", label: "Hours", render: v => `${(v || 0).toFixed(2)}h` },
            { key: "mileageDriven", label: "Miles", render: v => v ? `${v} mi` : "—" },
            { key: "equipmentUsed", label: "Equipment" },
          ]}
          rows={filtered}
          emptyMessage="No time entries yet."
        />
      </div>
    </div>
  );
}

// ─── Access Control Page ──────────────────────────────────────────────────────
function AccessControlPage() {
  const [employees] = useState(() => db.getAll("employees").items);
  const [permissions, setPermissions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bmb_permissions") || "{}"); } catch { return {}; }
  });
  const [editingId, setEditingId] = useState(null);
  const [editPerms, setEditPerms] = useState({});

  const permList = [
    { key: "canViewReports", label: "View Reports" },
    { key: "canEditQuotes", label: "Edit Quotes" },
    { key: "canManageSubcontractors", label: "Manage Subcontractors" },
    { key: "canViewManagerLogs", label: "View Manager Logs" },
    { key: "canEditSettings", label: "Edit Settings" },
    { key: "canDeleteEntries", label: "Delete Entries" },
  ];

  const save = () => {
    const updated = { ...permissions, [editingId]: editPerms };
    setPermissions(updated);
    localStorage.setItem("bmb_permissions", JSON.stringify(updated));
    setEditingId(null);
  };

  return (
    <div>
      <PageHeader title="Access Control" subtitle="Manage user permissions and role-based access" />
      {employees.length === 0
        ? <EmptyState icon="🔒" title="No employees found" subtitle="Add employees to manage their permissions." />
        : employees.map(emp => {
          const perms = permissions[emp._id] || {};
          const isEditing = editingId === emp._id;
          return (
            <div key={emp._id} style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.fullName}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{emp.role} — {emp.email}</div>
                </div>
                {!isEditing
                  ? <button onClick={() => { setEditingId(emp._id); setEditPerms({ ...perms }); }} style={btnOutline}>Edit Permissions</button>
                  : <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={save} style={btnSecondary}>Save</button>
                      <button onClick={() => setEditingId(null)} style={btnOutline}>Cancel</button>
                    </div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {permList.map(p => {
                  const val = isEditing ? editPerms[p.key] : perms[p.key];
                  return (
                    <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: val ? "#F0FDF4" : C.surfaceAlt, borderRadius: 8, cursor: isEditing ? "pointer" : "default", border: `1px solid ${val ? "#BBF7D0" : C.border}` }}>
                      {isEditing
                        ? <input type="checkbox" checked={!!val} onChange={e => setEditPerms(p2 => ({ ...p2, [p.key]: e.target.checked }))} style={{ accentColor: C.green }} />
                        : <span style={{ color: val ? C.green : C.textMuted, fontSize: 14 }}>{val ? "✅" : "🔒"}</span>}
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ─── Role Management Page ─────────────────────────────────────────────────────
function RoleManagementPage() {
  const [employees, setEmployees] = useState(() => db.getAll("employees").items);
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");

  const saveRole = (emp) => {
    db.update("employees", { ...emp, role: editRole });
    setEmployees(db.getAll("employees").items);
    setEditingId(null);
  };

  const roleColors = { Owner: ["#EDE9FE", "#7C3AED"], Manager: ["#EFF6FF", "#2563EB"], Employee: ["#F0FDF4", "#16A34A"] };

  return (
    <div>
      <PageHeader title="Role Management" subtitle="Assign and manage user roles across your organization" />
      {employees.length === 0
        ? <EmptyState icon="🛡️" title="No employees found" subtitle="Add employees to manage their roles." />
        : employees.map(emp => {
          const [bg, tx] = roleColors[emp.role] || [C.surfaceAlt, C.textMuted];
          const isEditing = editingId === emp._id;
          return (
            <div key={emp._id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{emp.fullName}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{emp.email}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {isEditing
                    ? <>
                        <Select value={editRole} onChange={setEditRole} options={["Owner", "Manager", "Employee", "Supervisor", "Crew Lead"]} style={{ width: 140 }} />
                        <button onClick={() => saveRole(emp)} style={btnSecondary}>Save</button>
                        <button onClick={() => setEditingId(null)} style={btnOutline}>Cancel</button>
                      </>
                    : <>
                        <Badge color={bg} textColor={tx}>{emp.role || "Unassigned"}</Badge>
                        <button onClick={() => { setEditingId(emp._id); setEditRole(emp.role || "Employee"); }} style={{ ...btnOutline, fontSize: 12, padding: "5px 12px" }}>Assign Role</button>
                      </>}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ─── Company Settings Page ────────────────────────────────────────────────────
function CompanySettingsPage() {
  const { company, updateCompany } = useCompany();
  const [form, setForm] = useState({
    companyName: company?.companyName || "",
    primaryColor: company?.primaryColor || "#111827",
    secondaryColor: company?.secondaryColor || "#16A34A",
    logoUrl: company?.logoUrl || "",
    address: company?.address || "",
    phone: company?.phone || "",
    email: company?.email || "",
    website: company?.website || "",
  });
  const [saved, setSaved] = useState(false);

  const save = () => { updateCompany(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <PageHeader title="Company Settings" subtitle="Customize your company branding and information" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Company Information</h3>
          <Field label="Company Name"><TextInput value={form.companyName} onChange={v => setForm(f => ({ ...f, companyName: v }))} placeholder="My Construction Company" /></Field>
          <Field label="Address"><TextInput value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="123 Main St, City, Province" /></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1 555 000 0000" /></Field>
          <Field label="Email"><TextInput value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="info@company.com" /></Field>
          <Field label="Website"><TextInput value={form.website} onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://yourcompany.com" /></Field>
        </div>
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Branding</h3>
          <Field label="Logo URL"><TextInput value={form.logoUrl} onChange={v => setForm(f => ({ ...f, logoUrl: v }))} placeholder="https://…/logo.png" /></Field>
          {form.logoUrl && <img src={form.logoUrl} alt="logo preview" style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain", marginBottom: 12, borderRadius: 6, border: `1px solid ${C.border}` }} />}
          <Field label="Primary Color">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} style={{ width: 48, height: 38, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}` }} />
              <TextInput value={form.primaryColor} onChange={v => setForm(f => ({ ...f, primaryColor: v }))} style={{ fontFamily: "monospace" }} />
            </div>
          </Field>
          <Field label="Secondary Color">
            <div style={{ display: "flex", gap: 8 }}>
              <input type="color" value={form.secondaryColor} onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))} style={{ width: 48, height: 38, borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}` }} />
              <TextInput value={form.secondaryColor} onChange={v => setForm(f => ({ ...f, secondaryColor: v }))} style={{ fontFamily: "monospace" }} />
            </div>
          </Field>
          <div style={{ marginTop: 8, padding: "12px", background: C.surfaceAlt, borderRadius: 8, fontSize: 12, color: C.textMuted }}>
            Preview: <span style={{ background: form.primaryColor, color: "#fff", padding: "2px 8px", borderRadius: 4, marginRight: 6 }}>Primary</span>
            <span style={{ background: form.secondaryColor, color: "#fff", padding: "2px 8px", borderRadius: 4 }}>Secondary</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
        <button onClick={save} style={btnSecondary}>Save Company Settings</button>
        {saved && <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>✓ Saved!</span>}
      </div>
    </div>
  );
}

// ─── Subscriptions Page ───────────────────────────────────────────────────────
function SubscriptionsPage() {
  const [currentPlan, setCurrentPlan] = useState(() => localStorage.getItem("bmb_plan") || "growth");
  const plans = [
    { id: "minimum", name: "Minimum", price: 24.99, users: 5, features: ["Core features", "Up to 5 team members", "Basic time tracking", "Inventory management", "Email support"] },
    { id: "growth", name: "Growth", price: 39.99, users: 20, features: ["All Minimum features", "Up to 20 team members", "Advanced time tracking", "Equipment management", "Quote generation", "Priority support", "Custom reports"], highlight: true },
    { id: "professional", name: "Professional", price: 49.99, users: 50, features: ["All Growth features", "Up to 50 team members", "Advanced analytics", "Subcontractor management", "Safety check templates", "Audit logs", "Phone support"] },
  ];

  const select = (id) => { setCurrentPlan(id); localStorage.setItem("bmb_plan", id); };

  return (
    <div>
      <PageHeader title="Subscription Plans" subtitle="Choose the plan that fits your business" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {plans.map(plan => (
          <div key={plan.id} style={{ ...card, marginBottom: 0, border: plan.highlight ? `2px solid ${C.secondary}` : `1px solid ${C.border}`, position: "relative" }}>
            {plan.highlight && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.secondary, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>MOST POPULAR</div>}
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</h3>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.accent, marginBottom: 4 }}>${plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted }}>/mo</span></div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Up to {plan.users} team members</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
              {plan.features.map(f => <li key={f} style={{ fontSize: 13, color: C.text, padding: "4px 0", display: "flex", gap: 8 }}><span style={{ color: C.green }}>✓</span>{f}</li>)}
            </ul>
            <button onClick={() => select(plan.id)} style={{ ...(currentPlan === plan.id ? btnPrimary : btnSecondary), width: "100%", opacity: currentPlan === plan.id ? 0.7 : 1 }}>
              {currentPlan === plan.id ? "Current Plan" : "Select Plan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Page ─────────────────────────────────────────────────────────────
function PricingPage() {
  const { navigate } = useRouter();
  return (
    <div>
      <div style={{ textAlign: "center", padding: "40px 20px 32px", background: C.primary, color: "#fff", borderRadius: 16, marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, letterSpacing: "-1px" }}>Simple, Transparent Pricing</h1>
        <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 20 }}>Choose the perfect plan for your construction business.</p>
        <div style={{ display: "inline-block", padding: "6px 16px", background: C.secondary, borderRadius: 20, fontSize: 13, fontWeight: 700 }}>All plans include a 14-day free trial</div>
      </div>
      <SubscriptionsPage />
      <div style={{ ...card, marginTop: 24, textAlign: "center" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Frequently Asked Questions</h3>
        {[
          ["Can I change my plan anytime?", "Yes, upgrade or downgrade at any time. Changes take effect on your next billing cycle."],
          ["Is there a long-term contract?", "No, all plans are month-to-month with no long-term commitment."],
          ["What happens to my data if I cancel?", "Your data is stored locally in your browser and can be exported at any time."],
          ["Do you offer annual billing discounts?", "Yes! Contact us for annual billing — save 15% on any plan."],
        ].map(([q, a]) => (
          <div key={q} style={{ textAlign: "left", padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{q}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, logout } = useAuth();
  const { company } = useCompany();
  return (
    <div>
      <PageHeader title="Your Profile" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ ...card, background: C.primary, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.secondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{user?.name || "User"}</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{user?.email}</div>
            </div>
          </div>
          {[["Role", user?.role || "Owner"], ["Company", company?.companyName || "—"]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.15)", fontSize: 13 }}>
              <span style={{ opacity: 0.7 }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <button onClick={logout} style={{ ...btnOutline, marginTop: 20, width: "100%", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Sign Out</button>
        </div>
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Account Status</h3>
          <div style={{ padding: "12px 16px", background: "#F0FDF4", borderRadius: 8, color: "#16A34A", fontWeight: 700, marginBottom: 12 }}>✅ Account Active</div>
          <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6 }}>You have full access to all BuildMyBill features including time tracking, job management, quotes, and reporting tools.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Updated App Shell ────────────────────────────────────────────────────────
function AppShell() {
  const { page } = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  const pages = {
    dashboard: <Dashboard />,
    quotes: <QuotesPage />,
    "quote-editor": <QuotesPage />,
    clients: <ClientsPage />,
    jobs: <JobsPage />,
    employees: <EmployeesPage />,
    subcontractors: <SubcontractorsPage />,
    "time-entry": <TimeEntryPage />,
    equipment: <EquipmentPage />,
    inventory: <InventoryPage />,
    schedule: <SchedulePage />,
    billing: <BillingPage />,
    safety: <SafetyPage />,
    contracts: <ContractsPage />,
    settings: <SettingsPage />,
    "truck-logs": <TruckLogBooksPage />,
    warehouses: <WarehousesPage />,
    "manager-logs": <ManagerLogsPage />,
    "daily-log": <DailyLogPage />,
    "employee-logs": <EmployeeLogsPage />,
    "access-control": <AccessControlPage />,
    "role-management": <RoleManagementPage />,
    "company-settings": <CompanySettingsPage />,
    subscriptions: <SubscriptionsPage />,
    pricing: <PricingPage />,
    profile: <ProfilePage />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FullSidebar />
      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto", minWidth: 0 }}>
        {pages[page] || <Dashboard />}
      </main>
    </div>
  );
}

// ─── Full Sidebar (replaces simple Sidebar) ───────────────────────────────────
const FULL_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "quotes", label: "Quotes & Invoices", icon: "📄" },
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "jobs", label: "Jobs / Projects", icon: "🏗️" },
  { id: "contracts", label: "Contracts", icon: "📋" },
  { id: "employees", label: "Employees", icon: "👤" },
  { id: "subcontractors", label: "Subcontractors", icon: "🔧" },
  { id: "time-entry", label: "Time Tracking", icon: "⏱️" },
  { id: "daily-log", label: "Daily Log", icon: "📝" },
  { id: "employee-logs", label: "Work Logs", icon: "📊" },
  { id: "manager-logs", label: "Manager Logs", icon: "📖" },
  { id: "equipment", label: "Equipment", icon: "🚛" },
  { id: "truck-logs", label: "Vehicle Logs", icon: "🚚" },
  { id: "safety", label: "Safety Checks", icon: "🦺" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "warehouses", label: "Warehouses", icon: "🏭" },
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "billing", label: "Billing & Reports", icon: "💰" },
  { id: "subscriptions", label: "Subscriptions", icon: "💳" },
  { id: "access-control", label: "Access Control", icon: "🔒" },
  { id: "role-management", label: "Role Management", icon: "🛡️" },
  { id: "company-settings", label: "Company Settings", icon: "🏢" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "profile", label: "Profile", icon: "👤" },
];

function FullSidebar() {
  const { page, navigate } = useRouter();
  const { company } = useCompany();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.secondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>B</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.3px", lineHeight: 1.2 }}>BuildMyBill</div>
            <div style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.2 }}>{company?.companyName || "My Company"}</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
        {FULL_NAV.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => { navigate(item.id); setMobileOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 12, fontWeight: active ? 600 : 400,
                marginBottom: 1, textAlign: "left", transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || user?.email}</div>
        <button onClick={logout} style={{ width: "100%", padding: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer" }}>Sign Out</button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: C.primary, color: "#fff", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, flexShrink: 0 }}>
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <div style={{ display: "none" }}>
        {/* reserved for future mobile implementation */}
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CompanyProvider>
          <AppShell />
        </CompanyProvider>
      </AuthProvider>
    </Router>
  );
}
