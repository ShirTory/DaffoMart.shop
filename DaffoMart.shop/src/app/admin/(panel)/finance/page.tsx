"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { ErrorBox, Field, Icon, Modal, PageHeader, PageLoader, Spinner, useConfirm, useToast } from "@/components/admin/ui";
import { taka } from "@/lib/format";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/types";

type Tab = "overview" | "income" | "expenses" | "pnl" | "cashflow" | "reports";

type Overview = {
  today: { revenue: number; expense: number; profit: number };
  month: { revenue: number; expense: number; profit: number };
  pendingReceivables: number;
  pendingCount: number;
};

type IncomeRow = {
  id: string; source: "order" | "manual"; orderId?: string; orderNo?: string;
  date: string; amount: number; paymentMethod: string; category: string; note: string;
};

type Expense = {
  id: string; category: string; amount: number; date: string; paymentMethod: string;
  note: string; receiptUrl?: string; orderId?: string;
};

const PAY_METHODS = ["cash", "cod", "bkash", "nagad", "online", "bank", "other"];

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function FinancePage() {
  const toast = useToast();
  const { confirm, node } = useConfirm();
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [ov, setOv] = useState<Overview | null>(null);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pnl, setPnl] = useState<any>(null);
  const [cf, setCf] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [reportType, setReportType] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [expEdit, setExpEdit] = useState<Partial<Expense> & { id?: string } | null>(null);
  const [incEdit, setIncEdit] = useState<{ id?: string; category: string; amount: string; date: string; paymentMethod: string; note: string } | null>(null);
  const [q, setQ] = useState("");

  const loadOverview = useCallback(async () => {
    setOv(await api<Overview>("/api/admin/finance/overview"));
  }, []);

  const loadIncome = useCallback(async () => {
    const rows = await api<IncomeRow[]>(`/api/admin/finance/income?from=${from}&to=${to}`);
    setIncome(rows);
  }, [from, to]);

  const loadExpenses = useCallback(async () => {
    const rows = await api<Expense[]>(`/api/admin/finance/expenses?from=${from}&to=${to}`);
    setExpenses(rows);
  }, [from, to]);

  const loadPnl = useCallback(async () => {
    setPnl(await api(`/api/admin/finance/profit-loss?from=${from}&to=${to}`));
  }, [from, to]);

  const loadCf = useCallback(async () => {
    setCf(await api(`/api/admin/finance/cashflow?from=${from}&to=${to}`));
  }, [from, to]);

  const loadReport = useCallback(async () => {
    setReport(await api(`/api/admin/finance/reports?type=${reportType}&from=${from}&to=${to}`));
  }, [from, to, reportType]);

  const reload = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      if (tab === "overview") await loadOverview();
      else if (tab === "income") await loadIncome();
      else if (tab === "expenses") await loadExpenses();
      else if (tab === "pnl") await loadPnl();
      else if (tab === "cashflow") await loadCf();
      else if (tab === "reports") await loadReport();
    } catch (e: any) {
      setErr(e.message || "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, [tab, loadOverview, loadIncome, loadExpenses, loadPnl, loadCf, loadReport]);

  useEffect(() => { reload(); }, [reload]);

  const filteredIncome = useMemo(() => {
    if (!q) return income;
    const s = q.toLowerCase();
    return income.filter((r) => r.note.toLowerCase().includes(s) || r.orderNo?.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) || r.paymentMethod.toLowerCase().includes(s));
  }, [income, q]);

  const filteredExpenses = useMemo(() => {
    if (!q) return expenses;
    const s = q.toLowerCase();
    return expenses.filter((r) => r.note.toLowerCase().includes(s) || r.category.toLowerCase().includes(s) || r.paymentMethod.toLowerCase().includes(s));
  }, [expenses, q]);

  const saveExpense = async () => {
    if (!expEdit) return;
    setBusy(true);
    try {
      const body = {
        category: expEdit.category || "Other",
        amount: Number(expEdit.amount),
        date: expEdit.date || today(),
        paymentMethod: expEdit.paymentMethod || "cash",
        note: expEdit.note || "",
        receiptUrl: expEdit.receiptUrl || undefined,
        orderId: expEdit.orderId || undefined,
      };
      if (expEdit.id) await api(`/api/admin/finance/expenses/${expEdit.id}`, { method: "PUT", body });
      else await api("/api/admin/finance/expenses", { method: "POST", body });
      toast(expEdit.id ? "Expense updated" : "Expense added");
      setExpEdit(null);
      await loadExpenses();
      await loadOverview().catch(() => {});
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const saveIncome = async () => {
    if (!incEdit) return;
    setBusy(true);
    try {
      const body = {
        category: incEdit.category || "Other Income",
        amount: Number(incEdit.amount),
        date: incEdit.date || today(),
        paymentMethod: incEdit.paymentMethod || "cash",
        note: incEdit.note || "",
      };
      if (incEdit.id) await api(`/api/admin/finance/income/${incEdit.id}`, { method: "PUT", body });
      else await api("/api/admin/finance/income", { method: "POST", body });
      toast(incEdit.id ? "Income updated" : "Manual income added");
      setIncEdit(null);
      await loadIncome();
      await loadOverview().catch(() => {});
    } catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const delExpense = async (id: string) => {
    if (!(await confirm("Delete this expense? This cannot be undone."))) return;
    try {
      await api(`/api/admin/finance/expenses/${id}`, { method: "DELETE" });
      toast("Expense deleted");
      await loadExpenses();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const delIncome = async (row: IncomeRow) => {
    if (row.source === "order") { toast("Order income is automatic and cannot be deleted", "err"); return; }
    if (!(await confirm("Delete this manual income entry?"))) return;
    try {
      await api(`/api/admin/finance/income/${row.id}`, { method: "DELETE" });
      toast("Income deleted");
      await loadIncome();
    } catch (e: any) { toast(e.message, "err"); }
  };

  const printReport = () => {
    window.print();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "income", label: "Income" },
    { id: "expenses", label: "Expenses" },
    { id: "pnl", label: "Profit & Loss" },
    { id: "cashflow", label: "Cashflow" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <>
      <PageHeader title="Finance & Accounts" subtitle="Sales revenue from delivered orders, expenses, profit, cashflow and reports — real business data only">
        <button type="button" className="btn-outline" onClick={() => reload()} disabled={loading}>Refresh</button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? "bg-primary text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "overview" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
          <Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <button type="button" className="btn-primary" onClick={() => reload()}>Apply</button>
          {(tab === "income" || tab === "expenses") && (
            <Field label="Search" className="min-w-[180px] flex-1">
              <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
          )}
        </div>
      )}

      {err && <ErrorBox msg={err} retry={reload} />}
      {loading ? <PageLoader /> : (
        <>
          {tab === "overview" && ov && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Card label="Today's revenue" value={taka(ov.today.revenue)} />
                <Card label="Today's expenses" value={taka(ov.today.expense)} tone="bad" />
                <Card label="Today's net profit" value={taka(ov.today.profit)} tone={ov.today.profit >= 0 ? "good" : "bad"} />
                <Card label="This month revenue" value={taka(ov.month.revenue)} />
                <Card label="This month expenses" value={taka(ov.month.expense)} tone="bad" />
                <Card label="This month net profit" value={taka(ov.month.profit)} tone={ov.month.profit >= 0 ? "good" : "bad"} />
              </div>
              <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Pending receivables:</strong> {taka(ov.pendingReceivables)}
                {ov.pendingCount > 0 ? ` (${ov.pendingCount} orders)` : " — none"}
              </div>
              <p className="text-xs text-gray-500">Revenue is taken from <strong>delivered</strong> orders only (automatic). Manual income and expenses are recorded under the Income / Expenses tabs.</p>
            </div>
          )}

          {tab === "income" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setIncEdit({ category: "Other Income", amount: "", date: today(), paymentMethod: "cash", note: "" })}>
                  <Icon name="plus" className="h-4 w-4" /> Manual income
                </button>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="th">Date</th><th className="th">Source</th><th className="th">Order</th>
                      <th className="th">Category</th><th className="th">Payment</th><th className="th">Amount</th>
                      <th className="th">Note</th><th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredIncome.length === 0 && <tr><td colSpan={8} className="td text-gray-500">No income in this range.</td></tr>}
                    {filteredIncome.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="td whitespace-nowrap">{r.date}</td>
                        <td className="td">{r.source === "order" ? <span className="badge bg-emerald-50 text-emerald-800">Order</span> : <span className="badge bg-blue-50 text-blue-800">Manual</span>}</td>
                        <td className="td">{r.orderId ? <Link href="/admin/orders" className="font-mono text-xs text-primary hover:underline">{r.orderNo || r.orderId.slice(0, 8)}</Link> : "—"}</td>
                        <td className="td">{r.category}</td>
                        <td className="td">{r.paymentMethod}</td>
                        <td className="td font-semibold tabular-nums">{taka(r.amount)}</td>
                        <td className="td max-w-[200px] truncate text-gray-500">{r.note}</td>
                        <td className="td text-right">
                          {r.source === "manual" && (
                            <>
                              <button type="button" className="btn-ghost btn-sm" onClick={() => setIncEdit({ id: r.id, category: r.category, amount: String(r.amount), date: r.date, paymentMethod: r.paymentMethod, note: r.note })}>Edit</button>
                              <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => delIncome(r)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">Total shown: <strong>{taka(filteredIncome.reduce((n, r) => n + r.amount, 0))}</strong> · Order rows are read-only and update when order status becomes delivered.</p>
            </div>
          )}

          {tab === "expenses" && (
            <div className="space-y-3">
              <button type="button" className="btn-primary" onClick={() => setExpEdit({ category: "Purchase", amount: undefined as any, date: today(), paymentMethod: "cash", note: "" })}>
                <Icon name="plus" className="h-4 w-4" /> Add expense
              </button>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="th">Date</th><th className="th">Category</th><th className="th">Payment</th>
                      <th className="th">Amount</th><th className="th">Note</th><th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredExpenses.length === 0 && <tr><td colSpan={6} className="td text-gray-500">No expenses in this range.</td></tr>}
                    {filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="td whitespace-nowrap">{e.date}</td>
                        <td className="td font-medium">{e.category}</td>
                        <td className="td">{e.paymentMethod}</td>
                        <td className="td font-semibold tabular-nums text-red-700">{taka(e.amount)}</td>
                        <td className="td max-w-[240px] truncate text-gray-500">{e.note}</td>
                        <td className="td text-right">
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setExpEdit({ ...e })}>Edit</button>
                          <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => delExpense(e.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">Total expenses: <strong>{taka(filteredExpenses.reduce((n, r) => n + r.amount, 0))}</strong></p>
            </div>
          )}

          {tab === "pnl" && pnl && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card label="Total income" value={taka(pnl.incomeTotal)} />
                <Card label="Total expense" value={taka(pnl.expenseTotal)} tone="bad" />
                <Card label="Net profit" value={taka(pnl.netProfit)} tone={pnl.netProfit >= 0 ? "good" : "bad"} sub="Recorded-expense basis" />
              </div>
              {pnl.salaryExpense !== undefined && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Card label="Item sales (net of discounts)" value={taka(pnl.itemSalesNet)} sub={`Gross ${taka(pnl.grossSales)} − discounts ${taka(pnl.discounts)}`} />
                    <Card label="Staff salaries" value={taka(pnl.salaryExpense)} tone="bad" sub="From Staff Payroll" />
                    <Card label="Rider earnings" value={taka(pnl.riderExpense)} tone="bad" sub="From Rider Earnings" />
                    <Card label="Delivery margin" value={taka(pnl.deliveryMargin)} tone={pnl.deliveryMargin >= 0 ? "good" : "bad"} sub={`Fees ${taka(pnl.deliveryFees)} − rider cost`} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card label="Cost of goods sold" value={taka(pnl.cogs)} sub={pnl.cogsComplete ? "From recorded product costs" : "Partial: some orders have no cost"} />
                    <Card label="Gross profit" value={pnl.grossProfit === null ? "Not available" : taka(pnl.grossProfit)} tone={pnl.grossProfit === null ? "neutral" : pnl.grossProfit >= 0 ? "good" : "bad"} />
                    <Card label="Net profit (COGS basis)" value={pnl.netProfitCogsBasis === null ? "Not available" : taka(pnl.netProfitCogsBasis)} tone={pnl.netProfitCogsBasis === null ? "neutral" : pnl.netProfitCogsBasis >= 0 ? "good" : "bad"} />
                  </div>
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{pnl.cogsNote} {pnl.formulas}</p>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="card p-4">
                  <h3 className="mb-2 font-bold">Income by category</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(pnl.byIncomeCat || {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold tabular-nums">{taka(v as number)}</span></li>
                    ))}
                    {!Object.keys(pnl.byIncomeCat || {}).length && <li className="text-gray-400">No income</li>}
                  </ul>
                </div>
                <div className="card p-4">
                  <h3 className="mb-2 font-bold">Expense by category</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(pnl.byExpenseCat || {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold tabular-nums text-red-700">{taka(v as number)}</span></li>
                    ))}
                    {!Object.keys(pnl.byExpenseCat || {}).length && <li className="text-gray-400">No expenses</li>}
                  </ul>
                </div>
              </div>
              <p className="text-xs text-gray-500">{pnl.from} → {pnl.to} · {pnl.incomeCount} income rows · {pnl.expenseCount} expenses</p>
            </div>
          )}

          {tab === "cashflow" && cf && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Cash basis: delivered orders count as cash in only once their payment is marked <b>paid</b> (cash-on-delivery is marked paid on delivery). Profit &amp; Loss counts every delivered order.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card label="Cash in" value={taka(cf.totalIn)} tone="good" />
                <Card label="Cash out" value={taka(cf.totalOut)} tone="bad" />
                <Card label="Closing balance" value={taka(cf.closingBalance)} tone={cf.closingBalance >= 0 ? "good" : "bad"} />
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Type</th><th className="th">Label</th><th className="th">Amount</th><th className="th">Running balance</th></tr></thead>
                  <tbody className="divide-y">
                    {(cf.rows || []).length === 0 && <tr><td colSpan={5} className="td text-gray-500">No movements in this range.</td></tr>}
                    {(cf.rows || []).map((r: any) => (
                      <tr key={r.id + r.date}>
                        <td className="td whitespace-nowrap">{r.date}</td>
                        <td className="td">{r.type === "in" ? <span className="text-emerald-700">In</span> : <span className="text-red-600">Out</span>}</td>
                        <td className="td">{r.label}</td>
                        <td className={`td font-semibold tabular-nums ${r.type === "in" ? "text-emerald-700" : "text-red-600"}`}>{r.type === "in" ? "+" : "−"}{taka(r.amount)}</td>
                        <td className="td tabular-nums font-medium">{taka(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-3 print:space-y-2">
              <div className="flex flex-wrap gap-2 print:hidden">
                {(["sales", "expenses", "pnl"] as const).map((t) => (
                  <button key={t} type="button" className={`rounded-full px-3 py-1.5 text-sm font-semibold ${reportType === t ? "bg-accent text-white" : "bg-white ring-1 ring-gray-200"}`}
                    onClick={() => setReportType(t)}>{t === "pnl" ? "P&L statement" : t === "sales" ? "Sales report" : "Expense report"}</button>
                ))}
                <button type="button" className="btn-outline" onClick={() => { loadReport(); }}>Load</button>
                <button type="button" className="btn-outline" onClick={printReport}><Icon name="print" className="h-4 w-4" /> Print / PDF</button>
              </div>
              {report && (
                <div className="card p-5" id="finance-report">
                  <h2 className="text-lg font-bold">DaffoMart — {report.type === "pnl" ? "Profit & Loss" : report.type === "expenses" ? "Expense Report" : "Sales Report"}</h2>
                  <p className="text-sm text-gray-500">{report.from} → {report.to}</p>
                  {"total" in report && <p className="mt-2 text-base font-bold">Total: {taka(report.total)}</p>}
                  {"netProfit" in report && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                      <div>Income: <strong>{taka(report.incomeTotal)}</strong></div>
                      <div>Expense: <strong>{taka(report.expenseTotal)}</strong></div>
                      <div>Net: <strong>{taka(report.netProfit)}</strong></div>
                    </div>
                  )}
                  {report.byCategory && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {Object.entries(report.byCategory).map(([k, v]) => (
                        <li key={k} className="flex justify-between border-b py-1"><span>{k}</span><span>{taka(v as number)}</span></li>
                      ))}
                    </ul>
                  )}
                  {report.byPayment && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {Object.entries(report.byPayment).map(([k, v]) => (
                        <li key={k} className="flex justify-between border-b py-1"><span>{k}</span><span>{taka(v as number)}</span></li>
                      ))}
                    </ul>
                  )}
                  {report.rows && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-left text-xs text-gray-500"><th className="py-1">Date</th><th>Detail</th><th className="text-right">Amount</th></tr></thead>
                        <tbody>
                          {report.rows.slice(0, 200).map((r: any) => (
                            <tr key={r.id} className="border-b border-gray-100">
                              <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                              <td className="pr-2">{r.category || r.note || r.orderNo || "—"}</td>
                              <td className="text-right tabular-nums">{taka(r.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={!!expEdit} onClose={() => !busy && setExpEdit(null)} title={expEdit?.id ? "Edit expense" : "Add expense"}
        footer={<><button className="btn-outline" onClick={() => setExpEdit(null)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={saveExpense} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {expEdit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select className="input" value={expEdit.category || ""} onChange={(e) => setExpEdit({ ...expEdit, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount (৳)"><input className="input" type="number" min={0} step="any" value={expEdit.amount ?? ""} onChange={(e) => setExpEdit({ ...expEdit, amount: e.target.value as any })} /></Field>
            <Field label="Date"><input className="input" type="date" value={expEdit.date || ""} onChange={(e) => setExpEdit({ ...expEdit, date: e.target.value })} /></Field>
            <Field label="Payment method">
              <select className="input" value={expEdit.paymentMethod || "cash"} onChange={(e) => setExpEdit({ ...expEdit, paymentMethod: e.target.value })}>
                {PAY_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Note" className="sm:col-span-2"><textarea className="input" rows={2} value={expEdit.note || ""} onChange={(e) => setExpEdit({ ...expEdit, note: e.target.value })} /></Field>
            <Field label="Order ID (optional)"><input className="input" value={expEdit.orderId || ""} onChange={(e) => setExpEdit({ ...expEdit, orderId: e.target.value })} /></Field>
            <Field label="Receipt URL (optional)"><input className="input" value={expEdit.receiptUrl || ""} onChange={(e) => setExpEdit({ ...expEdit, receiptUrl: e.target.value })} placeholder="/api/uploads/…" /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!incEdit} onClose={() => !busy && setIncEdit(null)} title={incEdit?.id ? "Edit manual income" : "Add manual income"}
        footer={<><button className="btn-outline" onClick={() => setIncEdit(null)} disabled={busy}>Cancel</button><button className="btn-primary" onClick={saveIncome} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
        {incEdit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select className="input" value={incEdit.category} onChange={(e) => setIncEdit({ ...incEdit, category: e.target.value })}>
                {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount (৳)"><input className="input" type="number" min={0} step="any" value={incEdit.amount} onChange={(e) => setIncEdit({ ...incEdit, amount: e.target.value })} /></Field>
            <Field label="Date"><input className="input" type="date" value={incEdit.date} onChange={(e) => setIncEdit({ ...incEdit, date: e.target.value })} /></Field>
            <Field label="Payment method">
              <select className="input" value={incEdit.paymentMethod} onChange={(e) => setIncEdit({ ...incEdit, paymentMethod: e.target.value })}>
                {PAY_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Note" className="sm:col-span-2"><textarea className="input" rows={2} value={incEdit.note} onChange={(e) => setIncEdit({ ...incEdit, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
