# AllAI Property Management Platform

## Overview
AllAI Property is a comprehensive platform for part-time landlords and small property management companies. It enables users to track properties, manage tenants, monitor maintenance, handle expenses, and stay organized with automated reminders. The platform supports various user types including platform super admins, organization admins (landlords), property owners, contractors, and tenants, each with role-based access control. Its goal is to provide an intuitive interface for managing real estate portfolios, including features like ownership entity management, smart case tracking, and automated regulatory compliance.

## Recent Changes
- **November 15, 2025**: Removed simplified TenantDashboardNew.tsx and fixed tenant cases API. Deleted the new simplified tenant dashboard to eliminate confusion - only the original full-featured tenant dashboard (with Maya AI, photo uploads, appointments) remains at `/tenant-dashboard` route. Fixed GET `/api/tenant/cases` to query by `reporterUserId` for new cases with fallback to `unitId` for legacy cases (handles existing cases where reporterUserId=null). Fixed POST `/api/tenant/cases` to include all required domain fields (priority, category, aiTriageJson, reporterUserId) and added media upload handling to persist photos in `caseMedia` table. Frontend restored full payload submission and corrected endpoint to `/api/tenant/cases`.
- **November 15, 2025**: Completed quote system UX improvements and archive functionality. Implemented inline line item editing (edit in same table row with check/cancel buttons), changed quantity input step to 1 for whole number increments while retaining decimal support, added delete confirmation dialog, and implemented soft-delete archive system with `archivedAt` timestamp. All quote retrieval methods automatically filter out archived quotes using `isNull(quotes.archivedAt)`. DELETE endpoint now archives instead of permanently deleting, preserving data for auditing/recovery. Status badges (Draft/Sent/Approved/Declined) display on all quote cards.
- **November 15, 2025**: Replaced multi-step quote update with atomic backend transaction. Created `updateQuoteWithLineItems` storage method using `db.transaction()` for ACID guarantees on quote + line item updates. Frontend now makes single PATCH/POST request instead of complex DELETE/CREATE/rollback orchestration. Schema validation uses dedicated update schemas that omit immutable fields (contractorId, approvalToken, quoteId, id).
- **November 15, 2025**: Implemented Phase 1 of quote/invoice system for contractors. Created `quote_status` enum (draft/sent/approved/rejected/expired), `deposit_type` enum (none/percentage/fixed), `quotes` table (customer link, totals, tax, deposit, expiry), and `quote_line_items` table (description, quantity, rate, amount, display order). Added 9 storage methods for quote CRUD. Built 8 secure API routes at `/api/contractor/quotes` with customer ownership verification, quote ownership checks, line item membership validation, and explicit guards against quoteId reassignment. All routes use storage layer exclusively with proper tenant isolation. Backend passes security audit with zero cross-contractor vulnerabilities.
- **November 15, 2025**: Transformed contractor workflow to manual customer management. Contractors can now manually add, edit, and delete customers through the Customers page. Created `contractor_customers` table with fields for name, email, company, phone, and notes. Added `customerId` field to `smart_cases` table to link work orders to customers. Work order creation form includes customer dropdown (contractors only). Work order cards display customer names via `customerId` field. Customer filter in Job Hub filters by `customerId` rather than property ownership. API endpoints: GET/POST/PATCH/DELETE `/api/contractor/customers` with proper validation and ownership checks.
- **November 15, 2025**: Fixed critical timezone bug in calendar reminder filtering. Date-only reminders (e.g., "2025-11-17") now parse correctly as org timezone midnight instead of UTC midnight. Day boundaries computed in org timezone (America/New_York) ensure reminders appear on correct calendar dates for users in any browser timezone. Added null dueAt guard in filters to prevent runtime errors.
- **November 15, 2025**: Implemented role-based field gating in ReminderForm. Contractors now see simplified form without property/entity/unit fields, which are automatically omitted from submission. Fixed contractors endpoint error by adding early role check before organization lookup.
- **November 12, 2025**: Removed predictive maintenance feature from Work Orders page (formerly Maintenance page). Terminology changed from "Smart Cases" to "Work Orders" throughout the application. The Predictive Maintenance tab has been removed, and all related predictive insights functionality (equipment failure predictions, maintenance forecasting) has been excised to streamline the contractor-focused workflow.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter for client-side routing.
- **UI**: shadcn/ui components built on Radix UI, styled with Tailwind CSS (light/dark mode).
- **State Management**: TanStack Query for server state and caching.
- **Forms**: React Hook Form with Zod for validation.

### Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript (ES modules).
- **Database ORM**: Drizzle ORM.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js.
- **Session Management**: Express sessions with PostgreSQL store.
- **Background Jobs**: Node-cron for scheduled tasks.
- **API Design**: RESTful API.

### Database
- **Primary Database**: PostgreSQL via Neon serverless driver.
- **Schema Management**: Drizzle migrations.
- **Key Entities**: Users, Organizations, Properties, Tenants, Leases, Units, Smart Cases, Financial transactions, Automated reminders.

### Authentication & Authorization
- **Provider**: Replit Auth (OpenID Connect).
- **Session Storage**: PostgreSQL-backed.
- **Protection**: Middleware-based authentication.
- **User Management**: Automatic user creation and organization assignment.
- **User Types**: Platform Super Admin, Org Admin, Contractor, Tenant, Property Owner.
- **Role-Based Access Control (RBAC)**: Middleware for data scoping and isolation across user types.

### Development & Deployment
- **Build System**: Vite for frontend, esbuild for backend.
- **Type Safety**: Shared TypeScript types across frontend and backend.

### UI/UX Decisions
- Focus on intuitive interfaces for property management.
- Multi-user dashboards tailored to each role (Admin, Landlord, Property Owner, Contractor, Tenant).
- Streamlined forms (e.g., Entity Form redesign with templates).
- Informational banners and clear notifications for user guidance.

### Feature Specifications
- Comprehensive property and tenant tracking.
- Maintenance issue management with smart case tracking.
- Financial transaction handling.
- Automated reminders.
- Contractor marketplace with specialty-based filtering.
- Email/SMS verification flows for multi-user authentication.
- Role-scoped data access for Maya AI.
- Auto-approval settings with single-active constraint.
- Prioritization of Property Owners on landing page for broader market appeal.

## External Dependencies

### Core Frameworks
- **@neondatabase/serverless**: PostgreSQL driver.
- **drizzle-orm**: Type-safe ORM.
- **express**: Web application framework.
- **@tanstack/react-query**: Server state management.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.

### UI & Styling
- **@radix-ui/***: Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **class-variance-authority**: Component variant utility.
- **lucide-react**: Icon library.

### Authentication & Session Management
- **passport**: Authentication middleware.
- **openid-client**: OpenID Connect client.
- **express-session**: Session middleware.
- **connect-pg-simple**: PostgreSQL session store.

### Integrations
- **Twilio**: SMS verification and emergency notifications (via Replit Connector).
- **SendGrid**: Email service (currently logs emails, setup pending).

### Utility Libraries
- **node-cron**: Cron job scheduler.
- **date-fns**: Date utility library.
- **clsx**: Conditional className utility.
- **memoizee**: Function memoization.