# Finance & Accounts — how it works

All pages live under **Admin → Finance** (Staff Payroll, Rider Earnings, Purchases & Suppliers, Balances & Dues) and extend the existing Finance module. No payment gateway is involved.

## Roles
| Role | Finance | Rest of admin | NID photos |
|---|---|---|---|
| Owner | yes | yes | yes (every view is audit-logged) |
| IT Support, full access granted by Owner | yes | yes | **no** (Owner only) |
| IT Support, no full access | no | no | no |
| **Accountant** (new; create under Admin → IT Support) | **yes** | **no (403 from the API)** | no |
| Rider | own earnings only (`/rider/earnings`, `/api/riders/me/earnings`) | no | no |

An Accountant can never be given full access (forced off on the server). Roles are re-read from the database on every request.

## New collections (additive; nothing renamed or removed)
`suppliers`, `purchases`, `payroll`, `finance_payments`, `finance_accounts`, `sku_index`. Optional new fields: `Employee.salaryHistory`, `Rider.payTerms`, `Product.cost`, `OrderItem.cost`. Firestore rules deny all client access to them.

## Rules and formulas
* **Salary**: one entry per staff per month (`id = employeeId:YYYY-MM`, so duplicates are impossible). Net payable = base + allowances + bonus + overtime − deductions − advances (never negative). `base` is stored on the entry; changing the staff member's current salary (Salary button, dated) never changes a recorded month.
* **Payments** (salary / rider / supplier / customer collection) share one ledger. Partial payments allowed; paying more than outstanding is refused; an idempotency key stops double submits. Posted payments are never deleted: **reverse** with a reason (kept with who/when).
* **Rider earnings** are derived from orders with status *delivered* and that rider: `perDelivery + commission% × delivery charge`, using the pay term in force on the delivery date. Each order earns once by construction; cancelled / returned / in-flight earn nothing. Fixed monthly pay, bonuses and deductions are **adjustments** (reason required). Balance = earned + adjustments − payments. Deliveries with no pay term are flagged "unrated" (nothing is invented).
* **Purchases**: a bill (supplier + invoice no.) cannot be entered twice. *Receive* adds stock once (per-line stock-log marker + purchase flag) and updates the product's **weighted-average cost**. Supplier payable = purchase total − supplier payments.
* **Money accounts**: each payment method is an account (COD = cash). Balance = opening balance + money in − money out, counting only movements on/after the opening date. Money in: delivered orders marked paid (minus any amount already collected separately), manual income, customer collections. Money out: expenses, salary, rider and supplier payments.
* **P&L** (`/api/admin/finance/profit-loss`): sales + other income − expenses where expenses = manual expenses + payroll (dated entries) + rider earnings/adjustments. Also reported: gross sales, discounts, delivery fees, delivery margin (= delivery fees − rider cost). **COGS / gross profit** use the unit cost snapshotted on each order line; if any delivered order in the period has no cost, gross profit and COGS-basis net profit are reported as *not available* instead of guessed.
* Manual expenses with category *Staff Salary* / *Rider Payment* are now refused (they would double count payroll). Old records are untouched and still counted.
* Purchases made through the Purchases module are inventory, not expenses: they reach profit through COGS. Do not also enter them as a manual "Purchase" expense.

## Known limitations
1. Concurrency guards (outstanding-balance checks, per-key locks) are per server instance; on several serverless instances two simultaneous *different* payments could both pass. Idempotency keys cover double-clicks.
2. Purchases cannot be edited or voided yet (record a correcting purchase / reverse payments).
3. Products bought before costs existed have no cost; COGS stays "not available" for periods containing orders placed before this release.
4. First purchase of a product that already has stock but no cost sets the cost to that purchase's unit cost.
5. Fixed monthly rider salary is recorded as an adjustment, not an automatic schedule.
6. Attendance data is not yet used to auto-calculate deductions (enter deductions manually).
7. SKU reservation: a failed save can hold its SKU for up to 2 minutes.
