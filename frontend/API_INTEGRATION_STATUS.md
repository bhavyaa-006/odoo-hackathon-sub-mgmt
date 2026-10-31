# Brightloop API Integration Status

This document tracks the integration status between the Brightloop Frontend and the FastAPI Backend (`http://localhost:8000`).

- **CONNECTED**: Fully implemented in the backend, integrated in the frontend, consuming live data.
- **BLOCKED**: Missing or not yet implemented on the backend; frontend calls actual route or returns standardized graceful empty/error state without fabricating data.

---

## Endpoint Integration Matrix

| Category | Feature | Frontend Service / Route | Backend Endpoint | Method | Status | Details / Blocker |
|---|---|---|---|---|---|---|
| **Auth** | Customer Login | `authService.login` | `/auth/login` | POST | **CONNECTED** | Returns Bearer JWT and user profile |
| **Auth** | Staff Login | `authService.login` | `/auth/login` | POST | **CONNECTED** | Enforces staff/finance roles |
| **Auth** | Admin Login | `authService.login` | `/auth/login` | POST | **CONNECTED** | Enforces admin role |
| **Auth** | Registration | `authService.signup` | `/auth/signup` | POST | **CONNECTED** | Creates customer account & issues JWT |
| **Auth** | Current User Profile | `authService.getCurrentUser` | `/auth/me` | GET | **CONNECTED** | Authenticates via Bearer token claims |
| **Auth** | Forgot Password | `authService.forgotPassword` | `/auth/forgot` | POST | **CONNECTED** | Initiates reset token |
| **Auth** | Reset Password | `authService.resetPassword` | `/auth/reset` | POST | **CONNECTED** | Consumes token & updates password |
| **Customer** | Overview Dashboard | `customerService.getOverview` | `/portal/overview` | GET | **CONNECTED** | Active subs count, unpaid amount & invoices |
| **Customer** | Profile View | `customerService.getProfile` | `/portal/profile` | GET | **CONNECTED** | Customer details, GSTIN, billing address |
| **Customer** | Profile Update | `customerService.updateProfile` | `/portal/profile` | PATCH | **CONNECTED** | Name, company, phone, GSTIN update |
| **Customer** | Invoice List | `invoiceService.getInvoices` | `/portal/invoices` | GET | **CONNECTED** | Filtered by authenticated customer ID |
| **Customer** | Invoice Detail | `invoiceService.getInvoice` | `/portal/invoices/{id}` | GET | **CONNECTED** | Customer-scoped detail verification |
| **Customer** | Invoice Direct Pay | `invoiceService.payInvoice` | `/portal/invoices/{id}/pay` | POST | **CONNECTED** | Direct checkout & auto-allocation |
| **Customer** | Invoice HTML Print | `invoiceService.getInvoicePrintData` | `/portal/invoices/{id}/print` | GET | **CONNECTED** | Rule 46 GST-compliant tax invoice HTML |
| **Customer** | Subscriptions List | `subscriptionService.getSubscriptions` | `/portal/subscriptions` | GET | **CONNECTED** | Returns customer subscriptions (`[]`) |
| **Customer** | Quotations List | `quotationService.getQuotations` | `/portal/quotations` | GET | **CONNECTED** | Returns customer quotations (`[]`) |
| **Customer** | Notifications List | `notificationService.getOutboxNotifications` | `/portal/notifications` | GET | **CONNECTED** | Returns customer notifications (`[]`) |
| **Customer** | Mark Notifications Read | `notificationService.markAsRead` | `/portal/notifications/read-all` | POST | **CONNECTED** | Marks notifications as read |
| **Customer** | Subscription Detail | `subscriptionService.getSubscription` | `/portal/subscriptions/{id}` | GET | **BLOCKED** | Backend pending subscription detail router |
| **Customer** | Subscription Action | `subscriptionService.performAction` | `/portal/subscriptions/{id}/action` | POST | **BLOCKED** | Backend pending pause/resume/cancel |
| **Customer** | Plan Change Preview | `subscriptionService.previewPlanChange` | `/portal/subscriptions/{id}/change/preview` | POST | **BLOCKED** | Backend pending proration calculation |
| **Customer** | Plan Change Apply | `subscriptionService.applyPlanChange` | `/portal/subscriptions/{id}/change/apply` | POST | **BLOCKED** | Backend pending tier change transition |
| **Customer** | Quotation Detail | `quotationService.getQuotation` | `/portal/quotations/{id}` | GET | **BLOCKED** | Backend pending customer quotation detail |
| **Customer** | Quotation Accept | `quotationService.acceptQuotation` | `/portal/quotations/{id}/accept` | POST | **BLOCKED** | Backend pending customer acceptance |
| **Catalogue** | Subscription Plans | `planService.getPlans` | `/api/v1/plans` | GET | **CONNECTED** | Active catalogue plans |
| **Catalogue** | Plan Detail | `planService.getPlan` | `/api/v1/plans/{id}` | GET | **CONNECTED** | Plan rules, interval, auto-close |
| **Catalogue** | Plan Availability | `planService.checkAvailability` | `/api/v1/plans/{id}/availability` | GET | **CONNECTED** | Date availability validation |
| **Catalogue** | Plan Pricing Breakdown | `planService.calculatePrice` | `/api/v1/plans/{id}/price` | POST | **CONNECTED** | Decimal quantity price calculator |
| **Catalogue** | Product List | `productService.getProducts` | `/api/v1/products` | GET | **CONNECTED** | Product catalogue with variants |
| **Catalogue** | Product Detail | `productService.getProduct` | `/api/v1/products/{id}` | GET | **CONNECTED** | Variant price adjustments |
| **Billing** | Invoices List | `invoiceService.getStaffInvoices` | `/invoices` | GET | **CONNECTED** | Staff/Admin paginated tax invoices |
| **Billing** | Invoice Detail | `invoiceService.getStaffInvoice` | `/invoices/{id}` | GET | **CONNECTED** | Itemized GST breakdown & balance |
| **Billing** | Invoice Confirm | `invoiceService.confirmInvoice` | `/invoices/{id}/confirm` | POST | **CONNECTED** | Draft -> Confirmed status lifecycle |
| **Billing** | Invoice Void / Cancel | `invoiceService.cancelInvoiceWithCreditNote` | `/invoices/{id}/void` | POST | **CONNECTED** | Void invoice |
| **Billing** | Billing Runs List | `billingService.getBillingRuns` | `/billing/runs` | GET | **CONNECTED** | Chronological batch billing runs |
| **Billing** | Billing Run Detail | `billingService.getBillingRun` | `/billing/runs/{id}` | GET | **CONNECTED** | Billing run items and error logs |
| **Billing** | Trigger Dry Run | `billingService.dryRunBillingRun` | `/billing/runs` | POST | **CONNECTED** | Dry run simulation (`dry_run: true`) |
| **Billing** | Commit Billing Run | `billingService.commitBillingRun` | `/billing/runs` | POST | **CONNECTED** | Live billing invoice creation (Admin) |
| **Payments** | Payment List | `paymentService.getPayments` | `/payments` | GET | **CONNECTED** | Payments ledger with allocations |
| **Payments** | Payment Detail | `paymentService.getPayment` | `/payments/{id}` | GET | **CONNECTED** | Allocation breakdown & receipts |
| **Payments** | Record Payment | `paymentService.recordPayment` | `/payments` | POST | **CONNECTED** | Payment intake & auto-allocation |
| **Payments** | Confirm Payment | `paymentService.confirmPayment` | `/payments/{id}/confirm` | POST | **CONNECTED** | Confirm cheque/bank payment |
| **Payments** | Reverse Payment | `paymentService.reversePayment` | `/payments/{id}/reverse` | POST | **CONNECTED** | Reverses allocations & updates status |
| **Payments** | Allocate Payment | `paymentService.allocatePayment` | `/payments/{id}/allocate` | POST | **CONNECTED** | Manual allocation to open invoice |
| **Taxes** | Tax Rules List | `taxService.getTaxRules` | `/taxes` | GET | **CONNECTED** | Active GST and Flat tax rules |
| **Taxes** | State Codes | `taxService.getStateCodes` | `/taxes/state-codes` | GET | **CONNECTED** | Indian 2-digit GST state codes |
| **Taxes** | GSTIN Checksum | `taxService.validateGSTIN` | `/taxes/validate-gstin` | GET | **CONNECTED** | Algorithmic GSTIN checksum |
| **Taxes** | Tax Calculation | `taxService.calculateTax` | `/taxes/calculate` | POST | **CONNECTED** | CGST+SGST vs IGST calculation |
| **Discounts** | Discount Rules List | `discountService.getDiscounts` | `/discounts` | GET | **CONNECTED** | Admin discount rules |
| **Discounts** | Discount Eligibility | `discountService.checkEligibility` | `/discounts/eligibility` | GET | **CONNECTED** | Code validity & date verification |
| **Discounts** | Apply Discount | `discountService.applyDiscount` | `/discounts/apply` | POST | **CONNECTED** | Order/invoice discount snapshot |
| **Staff Ops** | Customers List | `customerService.getStaffCustomers` | `/staff/customers` | GET | **BLOCKED** | Backend pending customer assignment |
| **Staff Ops** | Customer Detail | `customerService.getStaffCustomer` | `/staff/customers/{id}` | GET | **BLOCKED** | Backend pending customer detail view |
| **Staff Ops** | Staff Assignment | `customerService.assignStaff` | `/staff/customers/{id}/assign` | POST | **BLOCKED** | Backend pending reassignment endpoint |
| **Staff Ops** | Quotations List | `quotationService.getStaffQuotations` | `/staff/quotations` | GET | **BLOCKED** | Backend pending quotation workflow |
| **Staff Ops** | Quotation Templates | `quotationService.getQuotationTemplates` | `/staff/quotation-templates` | GET | **BLOCKED** | Backend pending templates |
| **Staff Ops** | Create Quotation | `quotationService.createQuotation` | `/staff/quotations` | POST | **BLOCKED** | Backend pending quotation generation |
| **Staff Ops** | Subscriptions List | `subscriptionService.getStaffSubscriptions` | `/staff/subscriptions` | GET | **BLOCKED** | Backend pending staff subscription list |
| **Staff Ops** | Subscription Detail | `subscriptionService.getStaffSubscription` | `/staff/subscriptions/{id}` | GET | **BLOCKED** | Backend pending staff subscription detail |
| **Staff Ops** | Overdue Summary | `invoiceService.getOverdueSummary` | `/staff/overdue` | GET | **BLOCKED** | Backend pending overdue aggregator |
| **Staff Ops** | Dunning Pipeline | `dunningService.getDunningOverview` | `/staff/dunning` | GET | **BLOCKED** | Backend pending dunning cases |
| **Staff Ops** | Credit Notes | `creditNoteService.getCreditNotes` | `/staff/credit-notes` | GET | **BLOCKED** | Backend pending credit note model |
| **Staff Ops** | Finance Metrics | `financeService.getFinanceMetrics` | `/staff/finance/metrics` | GET | **BLOCKED** | Backend pending executive finance router |
| **Staff Ops** | Integrity Checks | `integrityService.getIntegrityChecks` | `/staff/integrity` | GET | **BLOCKED** | Backend pending invariant engine |
| **Staff Ops** | Notifications Outbox | `notificationService.getStaffNotifications` | `/staff/notifications` | GET | **BLOCKED** | Backend pending transactional outbox |
| **Intelligence** | Ask Brightloop Search | `staffService.searchAll` | `/staff/search` | GET | **BLOCKED** | Backend pending cross-entity search |
| **Intelligence** | Ask Brightloop AI | `staffService.askAI` | `/ai/ask` | POST | **BLOCKED** | Backend pending AI assistant router |
| **Operations** | Time Machine Advance | `staffService.advanceTimeMachine` | `/staff/time-machine/advance` | POST | **BLOCKED** | Backend pending simulation clock |
| **System** | Liveness Probe | `staffService.healthCheck` | `/health` | GET | **CONNECTED** | Returns `{"status": "ok"}` |
