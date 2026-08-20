# Loka Accounting — Accurate feature parity audit

Audit source: 18 screenshots supplied on 20 August 2026. This document maps product capabilities, not Accurate's visual design or trademarks.

## Status definition

- **Ready**: backed by a real Loka API and persisted accounting data.
- **Covered**: workflow is supported through a broader Loka primitive such as business documents, dimensions, budgets, or journals.
- **Connector**: requires a third-party commercial account, credentials, and provider-specific contract before it can operate.

## Company and controls

| Accurate capability | Loka implementation | Status |
| --- | --- | --- |
| Company identity and address | Editable organization profile; user name remains separate | Ready |
| Branches | Organization branch master with headquarters marker | Ready |
| Tax configuration | Tax configs, Indonesian localization, statutory workpapers | Ready |
| Payment terms, shipping, FOB | Document due date, notes and workflow metadata | Covered |
| Salary/allowance and employees | Payroll runs with employee references | Ready |
| Recurring transactions and month-end | Recurring journals, fiscal close and period lock | Ready |
| Contacts | Customer/supplier contact master | Ready |
| Activity log | Append-only accounting and security audit events | Ready |
| Group/user access | Roles, permissions, invitations, member activation, MFA | Ready |
| Branch-scoped access | Branch master exists; membership-to-branch enforcement remains a follow-up hardening item | Covered |
| Numbering | Per-document sequence, prefix, padding and reset policy | Ready |
| Print design | PDF/XLSX/CSV report exporters; custom layout designer is not yet included | Covered |
| App store/API token | Scoped API keys, webhooks and integration event inbox | Ready |

## General ledger, bank, sales and purchasing

All screenshot menu entries are exposed through the new module directory. Core implementation includes chart of accounts, journals, reversal, opening balances, ledger, budget variance, bank statement import/matching/reconciliation, receivables/payables, aging, quotes, orders, deliveries/receipts, invoices, returns, approval policies and supplier/customer contacts.

## Inventory, assets, tax and reports

Inventory includes item/service masters, units, warehouses, adjustments, transfers, stock opname, reservations, per-warehouse balances, valuation and manufacturing completion. Fixed assets include acquisition and depreciation; changes/disposal/location are represented through journal and dimension controls. Tax includes Indonesian legal identity and PPN/PPh workpapers. Reports include trial balance, profit/loss, balance sheet, cash flow, aging, ledger and CSV/XLSX/PDF export.

## Provider-dependent connectors

The following are intentionally labeled **Perlu konektor** in the UI and are not presented as active without credentials:

- SmartLink e-Banking, virtual account and e-Payment
- marketplace/e-commerce synchronization
- e-Faktur CTAS submission and tax-invoice email delivery
- field-sales geolocation/check-in
- AI report analysis

These require a selected provider, API documentation, credentials and acceptance criteria. Loka already provides API keys, signed webhooks and idempotent integration events as the integration foundation.
