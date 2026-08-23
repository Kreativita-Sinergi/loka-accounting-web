export type Unit = { id: string; code: string; name: string; precision: number; is_active: boolean }
export type Item = { id: string; sku: string; name: string; item_type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE'; base_unit_id: string; category_id: string | null; brand_id: string | null; barcode: string | null; minimum_stock: string; costing_method: 'MOVING_AVERAGE' | 'FIFO'; sales_account_id: string | null; purchase_account_id: string | null; inventory_account_id: string | null; cogs_account_id: string | null; track_lots: boolean; track_serials: boolean; is_active: boolean }
/** One alternate unit expressed as numerator/denominator of the item's base unit. */
export type UnitConversion = { item_id: string; unit_id: string; numerator: number; denominator: number }
export type Warehouse = { id: string; code: string; name: string; address?: string; is_active: boolean }
export type BusinessDocument = {
  id: string
  document_type: string
  number: string
  contact_id: string | null
  project_id: string | null
  warehouse_id: string | null
  source_document_id: string | null
  document_date: string
  due_date: string | null
  currency_code: string
  status: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  notes: string | null
  lines?: BusinessDocumentLine[]
}
export type BusinessDocumentLine = {
  id: string
  sequence: number
  item_id: string | null
  unit_id: string | null
  description: string
  quantity: string
  unit_price_minor: number
  discount_minor: number
  tax_minor: number
  line_total_minor: number
}
export type InventoryBalance = { item_id: string; warehouse_id: string; sku: string; item_name: string; warehouse_code: string; warehouse_name: string; quantity: string; value_minor: number }

export type SecuritySettings = { require_2fa: boolean; approval_threshold_minor: number; session_ttl_minutes: number }
export type Invitation = { id: string; email: string; role_code: string; status: string; expires_at: string }
export type Approval = { id: string; entity_type: string; entity_id: string; amount_minor: number; status: string; requested_at: string }
export type DocumentSequence = { id: string; document_type: string; prefix: string; next_number: number; padding: number; reset_policy: string }
export type APIKey = { id: string; name: string; key_prefix: string; permissions: string[]; is_active: boolean; created_at: string }
export type Webhook = { id: string; name: string; endpoint_url: string; subscribed_events: string[]; is_active: boolean }
export type Onboarding = { business_id: string; business_type: 'SERVICE' | 'RETAIL' | 'DISTRIBUTION' | 'MANUFACTURING' | 'OTHER'; enabled_workflows: string[]; completed_steps: string[]; skipped_steps: string[]; current_step: number; started_at: string; completed_at: string | null; dismissed_at: string | null; updated_at: string }
export type ApprovalPolicy = { id: string; document_type: string; minimum_amount_minor: number; minimum_discount_basis_points: number; condition_mode: 'AND' | 'OR'; approver_role: string; is_active: boolean }
export type InventoryReservation = { id: string; item_id: string; warehouse_id: string; document_id: string; quantity: string; status: string; expires_at: string | null }
export type OrganizationMember = { user_id: string; email: string; full_name: string; role_code: string; is_active: boolean; created_at: string }
export type DocumentJournalRow = { journal_id: string; journal_number: string; transaction_date: string; description: string; account_id: string; account_code: string; account_name: string; debit_minor: number; credit_minor: number }
export type Attachment = { id: string; entity_type: string; entity_id: string; file_name: string; content_type: string; size_bytes: number; created_at: string }
export type ItemCategory = { id: string; parent_id: string | null; name: string; is_default: boolean; inventory_account_id: string | null; sales_account_id: string | null; cogs_account_id: string | null; is_active: boolean }
export type ItemBrand = { id: string; name: string; is_active: boolean }
export type CashTransactionLine = { id: string; sequence: number; account_id: string; description: string; contact_id: string | null; project_id: string | null; amount_minor: number }
export type CashTransaction = {
  id: string
  kind: 'RECEIPT' | 'PAYMENT' | 'TRANSFER'
  number: string
  transaction_date: string
  account_id: string
  destination_account_id: string | null
  contact_id: string | null
  fee_account_id: string | null
  fee_minor: number
  total_minor: number
  memo: string
  status: 'POSTED' | 'VOID'
  journal_entry_id: string
  reversal_journal_id: string | null
  lines?: CashTransactionLine[]
}
export type CashHistoryRow = { journal_id: string; journal_number: string; transaction_date: string; description: string; debit_minor: number; credit_minor: number; balance_minor: number }
