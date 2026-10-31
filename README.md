# Subscription Management System

A unified platform for managing products, subscription plans,
quotations, recurring billing, invoices, payments, discounts, and
financial reporting.

The system is designed around three user experiences---Admin, Staff, and
Customer---with role-based access and a shared subscription and billing
workflow.

------------------------------------------------------------------------

## 1. Project Overview

Brightloop Software sells products and add-ons through subscriptions.
Customers may be small businesses on monthly plans or larger
organizations on yearly contracts.

The platform should replace fragmented manual processes with one system
that can:

-   Set up products, variants, plans, taxes, and discount rules.
-   Manage customers, staff access, quotations, and subscriptions.
-   Generate invoices automatically when subscriptions are due for
    billing.
-   Record payments against invoices and identify outstanding balances.
-   Give customers a self-service portal for their own subscriptions and
    invoices.
-   Give the finance lead a consolidated view of revenue, payments,
    active subscriptions, and overdue invoices.

### Core goals

1.  Keep subscription and billing records accurate and consistent.
2.  Prevent subscriptions from being missed and invoices from being
    duplicated or skipped.
3.  Automate calculations and recurring billing wherever possible.
4.  Enforce access boundaries between administrators, staff, and
    customers.
5.  Keep the application responsive as the volume of records grows.

------------------------------------------------------------------------

## 2. User Roles and Access Control

The application has three interfaces. Access must be enforced by the
backend, not only by hiding frontend pages or buttons.

### 2.1 Admin

The Admin has system-wide control and can:

-   Create, edit, activate, and deactivate products and plans.
-   Configure product variants and variant price adjustments.
-   Configure taxes and discount rules.
-   Create staff accounts and manage staff access.
-   View and manage all customers, subscriptions, quotations, invoices,
    and payments.
-   Assign customers to staff members.
-   View all financial information and reports.
-   Configure subscription and billing policies.

**Only an Admin can create or add new staff members.**

### 2.2 Staff

Staff handle day-to-day operations with limited permissions.

-   View and manage customers assigned to them.
-   Create and manage quotations and subscriptions within their
    permissions.
-   View invoices and payment status for their assigned customers.
-   Confirm, cancel, send, or print invoices where permitted.
-   Record payments and follow up on overdue invoices where permitted.
-   Cannot create staff accounts.
-   Cannot create or publish discount rules.
-   Cannot access financial records belonging to customers outside their
    assignment, unless they have the Finance role.

### 2.3 Finance Staff / Finance Lead

Finance permissions should be represented as a staff role or permission
set.

-   Finance staff can view financial records across all customers.
-   The Finance Lead can access the financial dashboard and reporting
    views.
-   The dashboard should show active subscriptions, revenue, payments,
    outstanding balances, and overdue invoices.
-   Financial access must not automatically grant unrelated
    administrative permissions.

### 2.4 Customer

Customers use a self-service portal and can:

-   Register and sign in.
-   View and manage only their own account, subscriptions, quotations
    where applicable, and invoices.
-   View invoice details, payment history, and outstanding balances.
-   View subscription status, billing frequency, start date, and expiry
    date.
-   Access relevant subscription actions such as pause, cancellation, or
    renewal when the plan allows them.

A customer must never be able to access another customer's records by
changing an ID or URL.

------------------------------------------------------------------------

## 3. Authentication and Account Security

Customer registration and authentication are explicit system
requirements.

### Registration

-   Customers register using an email address and password.
-   Each email address can belong to only one account.
-   Passwords must be more than 8 characters long.
-   Passwords must contain at least:
    -   One uppercase letter.
    -   One lowercase letter.
    -   One special character.

### Password recovery

-   Customers can request a password reset.
-   A reset link must be sent to the registered email address.
-   Reset links should be time-limited and single-use.

### Security expectations

-   Store passwords using a secure password-hashing algorithm; never
    store plaintext passwords.
-   Enforce authorization on every protected backend endpoint.
-   Validate and sanitize user input.
-   Protect sensitive actions such as changing roles, applying
    discounts, and cancelling invoices.
-   Record important administrative and financial changes in an audit
    log.

------------------------------------------------------------------------

## 4. Product and Plan Management

Only authorized administrators should configure the product catalogue
and plan rules.

### 4.1 Product creation

A product should support:

-   Product name.
-   Product type.
-   Sales price.
-   Cost price.
-   Description or notes.
-   One or more variants.
-   Availability or sale status.

### 4.2 Product variants

Products may have variants, such as different brands or editions.

Each variant should be able to define a price adjustment. For example:

-   Base product price: ₹X.
-   Selecting the Odoo brand adds ₹560.
-   Final unit price is calculated from the base price and the selected
    variant adjustment.

The system should retain the selected variant and the applicable price
on the subscription line so that later catalogue changes do not silently
rewrite historical transactions.

### 4.3 Plan configuration

A plan defines how a product or service is sold and billed.

Each plan should support:

-   Plan name and associated product.
-   Billing interval: daily, weekly, monthly, or yearly.
-   Minimum quantity.
-   Availability start and end dates.
-   Pricing rules.
-   Subscription duration: indefinite or fixed-term.
-   Auto-renewal setting.
-   Automatic closure at expiry.
-   Whether early cancellation is allowed.
-   Whether pausing is allowed.
-   Whether renewal is allowed.

These settings should be configurable per plan rather than hardcoded
into only two plan types.

### 4.4 Subscription behaviour

The system must support at least these two broad duration models:

**Indefinite subscription**

-   Continues billing at the configured interval.
-   Continues until it is manually cancelled or otherwise ended under
    the plan's rules.
-   Can support pause and renewal behaviour when enabled by the plan.

**Fixed-term subscription**

-   Has a defined start date and end/expiry date.
-   Ends when the fixed term expires if automatic closure is enabled.
-   Must not generate charges after its valid term has ended.
-   May allow early cancellation or renewal if configured.

------------------------------------------------------------------------

## 5. Quotations and Subscription Creation

The system should support a quotation-to-subscription workflow,
especially for large customers.

### 5.1 Quotation templates

-   Provide reusable default quotation templates.
-   Templates can contain commonly used products, plans, and product
    lines.
-   Templates must have a validity period.
-   Once the validity period expires, the template-generated quotation
    should no longer be accepted without renewal or reissue.

### 5.2 Quotation and subscription details

Each quotation/subscription record should include:

-   Unique serial or reference number.
-   Customer.
-   Selected plan.
-   Start date.
-   End/expiry date, where applicable.
-   Payment terms.
-   Product lines.
-   Product and selected variant.
-   Quantity.
-   Unit price.
-   Applicable taxes.
-   Discounts, where applicable.
-   Line amount and overall total.

### 5.3 Lifecycle

The internal workflow is:

`Draft → Quotation → Confirmed → Active → Closed`

-   **Draft:** Being prepared; not yet issued as a quotation.
-   **Quotation:** Shared with the customer and valid for a defined
    period.
-   **Confirmed:** Accepted and approved for activation.
-   **Active:** Subscription is currently in effect.
-   **Closed:** Subscription has ended.

Transitions must be validated. For example, an expired quotation should
not be activated without being reissued or otherwise made valid.

The customer-facing portal may use simpler wording, but the underlying
states should remain consistent and understandable across the system.

------------------------------------------------------------------------

## 6. Billing and Invoice Management

Billing is a central part of the application and must be reliable under
batch processing.

### 6.1 Automatic invoice generation

On each billing run:

1.  Identify subscriptions that are due for billing.
2.  Check that each subscription is active and eligible to be billed.
3.  Calculate the billable period and quantities.
4.  Generate invoice lines from the subscription data.
5.  Populate customer details, product details, quantities, prices,
    discounts, taxes, and totals.
6.  Save the invoice and associate it with the originating subscription.
7.  Ensure the same billing period cannot be invoiced twice.

The team should not need to manually re-enter subscription details to
create recurring invoices.

### 6.2 Invoice details

Each invoice should include:

-   Unique invoice number.
-   Customer details.
-   Invoice date and due date.
-   Related subscription.
-   Billing period.
-   Product lines and descriptions.
-   Quantity and unit price.
-   Discounts.
-   Tax breakdown.
-   Subtotal and final total.
-   Amount paid.
-   Outstanding balance.
-   Invoice status.

### 6.3 Invoice actions and lifecycle

Authorized team members should be able to:

-   Confirm invoices.
-   Cancel invoices, subject to validation and audit logging.
-   Send invoices.
-   Print or export invoices.

The required invoice lifecycle is:

`Draft → Confirmed / Cancelled → Paid`

The implementation should also represent partially paid and overdue
invoices where applicable, without incorrectly marking them as paid.

### 6.4 Billing integrity

-   A subscription must not be billed twice for the same billing period.
-   Eligible subscriptions must not be skipped.
-   Invoice generation must be safe to retry after a failure.
-   Concurrent billing runs must not create duplicate invoices.
-   Use database transactions and appropriate uniqueness constraints or
    idempotency controls.
-   Keep a record of billing runs and failures so that staff can
    investigate and retry safely.

------------------------------------------------------------------------

## 7. Tax Management

-   Admins configure tax rules.
-   Taxes are calculated automatically when quotations and invoices are
    created.
-   Tax calculations should be visible in invoice line items and totals.
-   The system should retain the tax rate and calculation applied to a
    historical invoice, even if an administrator changes the tax
    configuration later.
-   The backend is the source of truth for tax calculations; do not rely
    only on frontend calculations.

The applicable tax rules and jurisdiction-specific behaviour should be
configured according to the hackathon's chosen assumptions.

------------------------------------------------------------------------

## 8. Discount Management

Only Admin users can create, edit, activate, or deactivate discount
rules.

### Discount rule fields

A discount rule should support:

-   Discount name or code.
-   Discount type: fixed amount or percentage.
-   Discount value.
-   Minimum purchase amount and/or minimum quantity.
-   Start date and end date.
-   Maximum number of uses.
-   Applicable products or plans.
-   Whether it applies to a product line or the entire subscription.
-   Active/inactive status.

### Discount behaviour

-   Apply a discount only when its conditions are satisfied.
-   Enforce usage limits.
-   Do not apply a rule before its start date or after its end date.
-   Apply eligible subscription discounts automatically to the next
    invoice.
-   Stop applying a discount when it expires or reaches its usage limit.
-   Record the discount applied to each invoice so historical invoices
    remain unchanged if the rule is edited later.
-   Prevent staff from creating or sharing unauthorized discount rules.

------------------------------------------------------------------------

## 9. Payments and Receivables

The system must record incoming payments and associate them with the
correct invoice.

### 9.1 Payment record

Each payment should contain:

-   Payment reference.
-   Related customer.
-   Related invoice.
-   Payment method.
-   Amount received.
-   Payment date.
-   Note or reference from the payment.
-   Recorded-by user.
-   Payment status, where relevant.

### 9.2 Payment behaviour

-   A payment must be linked to the correct invoice.
-   Support multiple payments against one invoice.
-   Update the invoice's amount-paid and outstanding-balance values.
-   Mark an invoice as paid only when its full payable amount has been
    settled.
-   Preserve payment history rather than overwriting previous payment
    records.
-   Handle overpayments and payment reversals according to the
    application's defined business rules.

### 9.3 Outstanding and overdue invoices

-   Show invoices that are unpaid, partially paid, and overdue.
-   Calculate outstanding balances.
-   Make overdue invoices visible to authorized staff and finance users.
-   Allow the team to follow up with customers on overdue payments.
-   Keep a clear history of payment and follow-up activity.

Payment recording in this scope does not automatically imply integration
with a payment gateway; gateway integration can be added separately if
required.

------------------------------------------------------------------------

## 10. Finance Dashboard and Reporting

The Finance Lead needs a consolidated view of the company's subscription
and financial position.

### Dashboard metrics

-   Total active subscriptions.
-   Total revenue collected.
-   Revenue by month.
-   Revenue by quarter.
-   Revenue by half-year.
-   Revenue by year.
-   Total payments received.
-   Outstanding receivables.
-   Number and value of overdue invoices.
-   Subscription and invoice summaries.

### Filters and views

Provide filters such as:

-   Date range.
-   Customer.
-   Product or plan.
-   Subscription status.
-   Invoice status.
-   Payment method.
-   Staff/customer assignment, where relevant.

The dashboard should include a summary/list view that lets finance users
move from a high-level metric to the underlying subscriptions, invoices,
or payments.

### Financial terminology

Keep these concepts distinct:

-   **Revenue collected:** Money actually received.
-   **Outstanding receivables:** Amount invoiced but not yet paid.
-   **Overdue receivables:** Outstanding amounts past their due date.

Do not label all invoice totals as collected revenue.

------------------------------------------------------------------------

## 11. Customer and Staff Assignment

-   Admins can assign customers to staff members.
-   Staff can access records only for customers assigned to them, unless
    they have an explicit broader permission such as Finance.
-   Admins can reassign customers.
-   Assignment changes should be recorded in the audit log.
-   Customers can access only their own records regardless of staff
    assignment.

------------------------------------------------------------------------

## 12. Notifications

Notifications are a recommended supporting feature.

Potential notifications include:

-   Customer account registration and password reset.
-   Quotation issued or nearing expiry.
-   Subscription activation.
-   Upcoming renewal or billing date.
-   Invoice issued.
-   Payment received.
-   Invoice becoming overdue.
-   Subscription expiry or closure.

Notifications should not replace the underlying invoice, payment, or
subscription records. Failed notifications should be retryable and
should not cause duplicate billing.

------------------------------------------------------------------------

## 13. Auditability and Operational Reliability

The system should maintain an audit trail for important events,
including:

-   Product and plan changes.
-   Staff account and permission changes.
-   Customer assignment changes.
-   Quotation creation and confirmation.
-   Subscription activation, pause, renewal, and closure.
-   Invoice creation, confirmation, cancellation, and sending.
-   Discount creation and application.
-   Payment recording, correction, or reversal.

Each audit event should capture the actor, action, affected record,
timestamp, and relevant change details.

Sensitive financial records should not be silently overwritten or
deleted. Use explicit correction, cancellation, or reversal workflows
where appropriate.

------------------------------------------------------------------------

## 14. Performance and Scalability

The official problem statement requires every page to respond in **under
two seconds**, even with thousands of subscriptions.

### Performance target

-   Target page response time: under 2 seconds.
-   Design for tens of thousands of subscription records and large
    invoice/payment histories.
-   Avoid loading all records into the browser at once.

### Implementation considerations

-   Add database indexes for frequently filtered and joined fields.
-   Use server-side pagination, filtering, and sorting.
-   Optimize dashboard queries and aggregate data efficiently.
-   Avoid N+1 database query patterns.
-   Use background jobs for large billing batches and non-immediate
    notifications.
-   Cache expensive read-only summaries where appropriate.
-   Measure response times with realistic data volumes.

The two-second target should be tested and measured; it should not be
assumed merely because the interface appears responsive during
development.

------------------------------------------------------------------------

## 15. Suggested Core Data Entities

The following is a suggested starting point for the data model. Exact
table names and relationships can be adjusted during implementation.

  -----------------------------------------------------------------------
  Entity                              Purpose
  ----------------------------------- -----------------------------------
  User                                Authentication identity and account
                                      status

  Role / Permission                   Access control for Admin, Staff,
                                      Finance, and Customer

  Customer                            Customer business/profile
                                      information

  StaffAssignment                     Maps customers to responsible staff

  Product                             Product catalogue and base pricing

  ProductVariant                      Variant options and price
                                      adjustments

  Plan                                Billing interval, duration, and
                                      plan rules

  QuotationTemplate                   Reusable quotation configuration

  Quotation                           Customer offer and validity

  Subscription                        Active or historical customer
                                      subscription

  SubscriptionLine                    Products, variants, quantities, and
                                      prices

  TaxRule                             Admin-configured tax settings

  DiscountRule                        Discount conditions and usage
                                      limits

  DiscountApplication                 Records where a discount was
                                      applied

  Invoice                             Billing document and payment state

  InvoiceLine                         Product, quantity, price, tax, and
                                      discount breakdown

  Payment                             Incoming payment record

  BillingRun                          Tracks scheduled or manual billing
                                      batches

  Notification                        Delivery status for system
                                      notifications

  AuditLog                            History of important user and
                                      system actions
  -----------------------------------------------------------------------

### Important data integrity rules

-   Use unique constraints for account emails and document reference
    numbers.
-   Link invoices to their source subscriptions and billing periods.
-   Prevent duplicate invoices for the same subscription and billing
    period.
-   Use transactions when generating invoices and recording payments.
-   Preserve historical prices, taxes, and discounts on issued financial
    documents.
-   Enforce customer and staff access restrictions in backend queries.

------------------------------------------------------------------------

## 16. Suggested Application Modules

A practical module breakdown:

1.  Authentication and authorization.
2.  User, staff, and customer management.
3.  Product catalogue and variants.
4.  Plan configuration.
5.  Quotations and templates.
6.  Subscription lifecycle management.
7.  Billing scheduler and invoice generation.
8.  Tax calculation.
9.  Discount management.
10. Payment recording and reconciliation.
11. Overdue invoice management.
12. Finance dashboard and reports.
13. Notifications.
14. Audit logging and system settings.

------------------------------------------------------------------------

## 17. Suggested Implementation Priorities

### Phase 1 --- Foundation

-   Authentication and role-based access.
-   Customer and staff management.
-   Product and variant catalogue.
-   Plan configuration.

### Phase 2 --- Sales and subscriptions

-   Quotation templates.
-   Quotation lifecycle.
-   Subscription creation and state transitions.
-   Pause, cancellation, expiry, and renewal rules.

### Phase 3 --- Billing and finance

-   Tax calculation.
-   Discount rules and applications.
-   Automatic invoice generation.
-   Duplicate-billing prevention.
-   Payment recording and invoice reconciliation.
-   Outstanding and overdue invoice views.

### Phase 4 --- Dashboards and polish

-   Customer portal.
-   Staff workspace.
-   Finance dashboard and filters.
-   Notifications.
-   Audit logs.
-   Performance testing and optimization.

The order can be adjusted to fit the hackathon timeline, but billing
integrity and access control should not be postponed until the end.

------------------------------------------------------------------------

## 18. Acceptance Checklist

Use this checklist to verify the implementation against the problem
statement.

### Access and authentication

-   [ ] Three interfaces exist: Admin, Staff, and Customer.
-   [ ] Backend authorization enforces role boundaries.
-   [ ] Only Admin can create staff accounts.
-   [ ] Customer emails are unique.
-   [ ] Password rules are enforced.
-   [ ] Password reset links are sent to registered email addresses.
-   [ ] Customers can access only their own records.
-   [ ] Staff can access only assigned customers unless explicitly
    granted broader access.
-   [ ] Finance staff can view all relevant financial records.

### Products and plans

-   [ ] Products include name, type, sales price, cost price, and notes.
-   [ ] Product variants can add or adjust prices.
-   [ ] Plans support daily, weekly, monthly, and yearly billing.
-   [ ] Plans support minimum quantity and availability dates.
-   [ ] Indefinite and fixed-term subscriptions are supported.
-   [ ] Auto-renewal, auto-close, pause, early cancellation, and renewal
    are configurable per plan.

### Quotations and subscriptions

-   [ ] Reusable quotation templates are available.
-   [ ] Quotation validity periods are enforced.
-   [ ] Subscription records contain the required customer, plan, dates,
    terms, and line details.
-   [ ] Subscription reference numbers are unique.
-   [ ] Draft, Quotation, Confirmed, Active, and Closed states are
    supported.
-   [ ] State transitions are validated.

### Billing and invoices

-   [ ] Invoices are generated from subscription data.
-   [ ] Customer and product details are populated automatically.
-   [ ] Taxes and discounts are calculated automatically.
-   [ ] Invoice actions include confirm, cancel, send, and print.
-   [ ] Invoice states include Draft, Confirmed, Cancelled, and Paid.
-   [ ] Partial payments and overdue states are represented correctly.
-   [ ] A subscription cannot be billed twice for the same period.
-   [ ] Eligible subscriptions are not skipped during billing.
-   [ ] Billing jobs can be retried safely.

### Discounts

-   [ ] Only Admin can create discount rules.
-   [ ] Fixed and percentage discounts are supported.
-   [ ] Minimum purchase or quantity conditions are supported.
-   [ ] Start and end dates are enforced.
-   [ ] Usage limits are enforced.
-   [ ] Product-specific and subscription-wide discounts are supported.
-   [ ] Eligible discounts appear on the next invoice automatically.

### Payments and finance

-   [ ] Payments record method, amount, date, note, and invoice.
-   [ ] Multiple payments can be recorded against an invoice.
-   [ ] Outstanding balances update correctly.
-   [ ] Paid invoices are not marked paid before full settlement.
-   [ ] Overdue invoices can be identified and followed up.
-   [ ] Finance dashboard shows active subscriptions, revenue, payments,
    and overdue invoices.
-   [ ] Monthly, quarterly, half-yearly, and yearly revenue views are
    available.
-   [ ] Filters and summary/list views are available.

### Performance and reliability

-   [ ] Pages are tested against the under-two-second response target.
-   [ ] The system is tested with thousands of subscriptions.
-   [ ] Server-side pagination and filtering are implemented.
-   [ ] Database indexes and query performance are reviewed.
-   [ ] Billing operations use transaction and duplicate-prevention
    safeguards.
-   [ ] Important actions are recorded in audit logs.

------------------------------------------------------------------------

## 19. Scope Notes

This README combines the requirements explicitly stated in the hackathon
problem statement with additional implementation recommendations.

-   The core workflows---roles, customer registration, products, plans,
    quotations, subscriptions, invoices, taxes, discounts, payments,
    finance reporting, and performance---come from the problem
    statement.
-   Features such as audit logs, notifications, detailed reconciliation,
    and the suggested data entities are engineering recommendations to
    make the system more robust.
-   Payment gateway integration, accounting-platform integration, and
    jurisdiction-specific tax compliance are not assumed to be included
    unless the team explicitly chooses to implement them.

------------------------------------------------------------------------

## 20. Definition of Done

The project is ready for demonstration when a complete business flow can
be shown:

1.  An Admin creates a product, variant, plan, tax rule, and discount
    rule.
2.  A customer registers and signs in.
3.  A staff member creates a quotation using a template.
4.  The quotation is confirmed and converted into a subscription.
5.  The subscription becomes active under its configured rules.
6.  The billing process generates the correct invoice automatically.
7.  The invoice contains the correct product lines, taxes, and
    discounts.
8.  A payment is recorded against the invoice.
9.  The invoice's paid amount and outstanding balance update correctly.
10. The customer can see their own subscription and invoice in the
    portal.
11. Staff can see only their assigned customers, while Finance can
    access all financial records.
12. The Finance Lead can review active subscriptions, collected revenue,
    outstanding amounts, and overdue invoices.
13. The billing process can be retried without creating duplicate
    invoices.
14. The application remains responsive with thousands of subscription
    records.

------------------------------------------------------------------------

**Project:** Subscription Management System\
**Problem context:** Brightloop Software\
**Primary objective:** A reliable, role-based platform for the complete
subscription-to-cash lifecycle.
