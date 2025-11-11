# AllAI Property Management Platform

## Overview
AllAI Property is a comprehensive property management platform designed for part-time landlords and small property management companies. It enables users to track properties, manage tenants, monitor maintenance issues, handle expenses, and stay organized with automated reminders. The platform aims to provide an intuitive interface for managing real estate portfolios, including features like ownership entity management, smart case tracking, and automated regulatory compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite for building.
- **Routing**: Wouter for client-side routing, including protected routes.
- **UI Framework**: shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS (light/dark mode support).
- **State Management**: TanStack Query for server state management and caching.
- **Forms**: React Hook Form with Zod for type-safe validation.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database ORM**: Drizzle ORM for type-safe database operations.
- **Authentication**: Replit Auth (OpenID Connect) via Passport.js.
- **Session Management**: Express sessions with PostgreSQL store.
- **Background Jobs**: Node-cron for scheduled tasks.
- **API Design**: RESTful API with consistent error handling.

### Database Design
- **Primary Database**: PostgreSQL via Neon serverless driver.
- **Schema Management**: Drizzle migrations.
- **Key Entities**: Users, Organizations, Properties, Tenants, Leases, Units, Smart Cases, Financial transactions, and Automated reminders.
- **Relationships**: Complex many-to-many relationships, especially for properties and ownership entities.

### Authentication & Authorization
- **Provider**: Replit Auth using OpenID Connect.
- **Session Storage**: PostgreSQL-backed sessions.
- **Protection**: Middleware-based authentication on client and server.
- **User Management**: Automatic user creation and organization assignment.

### Development & Deployment
- **Build System**: Vite for frontend, esbuild for backend production builds.
- **Type Safety**: Shared TypeScript types across frontend and backend.

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL driver.
- **drizzle-orm**: Type-safe ORM.
- **express**: Web application framework.
- **@tanstack/react-query**: Server state management.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.

### UI & Styling Dependencies
- **@radix-ui/***: Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **class-variance-authority**: Component variant utility.
- **lucide-react**: Icon library.

### Authentication & Session Management
- **passport**: Authentication middleware.
- **openid-client**: OpenID Connect client.
- **express-session**: Session middleware.
- **connect-pg-simple**: PostgreSQL session store.

### Development & Build Tools
- **vite**: Frontend build tool.
- **tsx**: TypeScript execution.
- **esbuild**: JavaScript bundler.
- **@replit/vite-plugin-runtime-error-modal**: Development error handling.
- **@replit/vite-plugin-cartographer**: Replit-specific dev tools.

### Utility Libraries
- **node-cron**: Cron job scheduler.
- **date-fns**: Date utility library.
- **clsx**: Conditional className utility.
- **memoizee**: Function memoization.

## Integration Notes

### Twilio Integration (✅ CONFIGURED)
- **Status**: Active via Replit Connector
- **Purpose**: SMS verification codes for contractor/tenant signup, emergency notifications
- **Implementation**: `server/services/twilioClient.ts` using Replit's connector API
- **Usage**: Automatic phone verification in multi-user authentication flows

### SendGrid Integration (❌ NOT CONFIGURED)
- **Status**: User dismissed integration setup
- **Alternative**: Email service (`server/services/emailService.ts`) uses graceful fallback - logs email content without sending
- **Future**: Can be configured later via Replit SendGrid connector or manual API key
- **Note**: Magic link authentication and tenant invites will log emails to console until configured

## Recent Changes (November 2025)

### Multi-User Authentication System Transformation
The platform has been transformed from a single-user toggle-based role system to a full multi-user authentication platform supporting four distinct user types with separate logins and role-based access control.

**User Types:**
1. **Platform Super Admin** (owners) - Full system access, view all orgs
2. **Org Admin** (landlords) - Property management, tenant invites, contractor favorites
3. **Contractor** - Job marketplace access with specialty-based filtering
4. **Tenant** - Unit view, case submission, appointment approval

**Key Features Implemented:**
- Email/SMS verification flows with magic links and verification codes
- Session management with indefinite refresh tokens (localStorage-based)
- RBAC middleware with data scoping utilities
- Contractor marketplace with 60 specialties across 6 tiers
- 4-hour timeout notifications for hands-off landlords on non-urgent cases
- Cron jobs for timeout checks (30 min) and session cleanup (daily 4 AM)

**Security Considerations:**
- Refresh tokens stored in localStorage (high-severity XSS risk - acceptable for MVP, should migrate to httpOnly cookies + short-lived access tokens before production)
- Data scoping prevents contractors from accessing portfolio data
- Role-based query filters ensure data isolation

**Completed Features:**
- ✅ Platform Admin dashboard (`/admin-dashboard`) - View all orgs, users, system stats
- ✅ Landlord (Org Admin) dashboard (`/landlord-dashboard`) - Properties, tenants, cases, favorites
- ✅ **Property Owner dashboard (`/property-owner-dashboard`) - Homeowners without tenants** ⭐
  - Personal property management (no tenant/entity complexity)
  - Contractor favorites and marketplace access
  - Maintenance case tracking
  - Auto-provisioned personal organization
- ✅ Contractor dashboard (`/contractor-dashboard`) - Marketplace, assigned jobs, proposals
- ✅ Tenant dashboard (`/tenant-dashboard-new`) - Unit view, case submission, appointment approval
- ✅ Tenant auto-invite flow - Landlord invites tenant → email verification → auto-account creation
- ✅ Maya AI role-scoped data access:
  - Platform admins: Full system access
  - Landlords: Full org context (properties, tenants, cases)
  - Property owners: Property context only (NO tenant/entity data)
  - Contractors: Job context only (NO portfolio/financial data)
  - Tenants: Unit context only (their cases)

**Security Validations Completed:**
- ✅ Tenant verification tokens bound to email/tenantId (prevents replay attacks)
- ✅ Contractor Maya scoping validates assignment before returning job context
- ✅ RBAC middleware validates orgRole membership to prevent cross-org leakage
- ✅ Property owner favorites use correct schema fields (contractorUserId)
- ✅ Data scoping utilities prevent contractors from accessing portfolio/financial data

**Landing Page Market Positioning (November 11, 2025):**
- ✅ **Property Owners prioritized** - Featured first with "Popular" badge, dedicated signup page
- ✅ Hero section repositioned: "Your Home, Simplified" targets homeowner market
- ✅ User type order: Property Owners → Landlords → Tenants → Contractors
- ✅ Platform Admin hidden from public view (direct URL only)
- ✅ Property Owner signup page (`/property-owner-signup`) with email verification
- Business rationale: Property Owners = largest addressable market (millions of homeowners)

**Testing Status:**
- 📋 Comprehensive testing plan created in `TESTING_PLAN.md`
- 5-phase testing approach: Platform Admin → Landlord → Property Owner → Tenant → Contractor → Security
- Quick start guide included (1-hour complete testing path)

**Recent Updates (November 11, 2025 - Latest):**
- ✅ **Legacy role toggle system REMOVED** - Deleted RoleContext, all components now use useAuth().user.primaryRole
- ✅ **Test accounts created** - 6 test users with realistic data for systematic testing
- ✅ **Super Admin Dashboard enhancements:**
  - Clickable stat cards that scroll to detailed sections (organizations, users, properties, cases)
  - Searchable and sortable data tables with scrollable containers (max-height)
  - Sidebar streamlined to Dashboard and Inbox only (removed Reminders, Request & Calendar)
  - Maya AI with super admin context for platform-wide insights - now full-width above all tables
  - Removed org-specific widgets (Reminders/Notifications) from super admin view
  - Full-width layout: Stats → Maya AI → Organizations table → Users table (no horizontal scrolling)
- ✅ **Auto-Approval Settings Enhancement:**
  - Single-active constraint: Only one approval policy can be active at any time
  - Backend enforcement: Activating a policy automatically deactivates all others for that organization
  - Frontend notifications: Toast warnings and informational text explain the constraint
  - Settings menu simplified: Only landlords (org_admin) can access Approval Settings

**Test Accounts & Data (November 11, 2025):**

1. **Platform Super Admin**
   - Email: `admin@test.com`
   - Role: platform_super_admin
   - Expected: See all orgs, all system data, full dashboard access
   - Test: Verify can view data from all organizations

2. **Landlord 1 (Org A - Test Org A - Landlord 1)**
   - Email: `landlord1@test.com`
   - Role: org_admin
   - Data: 2 properties (Maple Street Apartments, Oak Avenue House), 5 units, 3 tenants (Sarah, Michael, Emma), 5 cases
   - Expected: Dashboard shows properties/tenants/cases/entities sections
   - Test: Verify ONLY sees Org A data, NO access to Org B

3. **Landlord 2 (Org B - Test Org B - Landlord 2)**
   - Email: `landlord2@test.com`
   - Role: org_admin
   - Data: 1 property (Pine Ridge Condo), 1 unit, 1 tenant (Jessica), 2 cases
   - Expected: Dashboard shows properties/tenants/cases/entities sections
   - Test: Verify ONLY sees Org B data, NO access to Org A (data isolation check)

4. **Property Owner (Personal Org - Test Property Owner Personal)**
   - Email: `propertyowner@test.com`
   - Role: property_owner
   - Data: 1 property (My Personal Home), 0 tenants, 2 cases (HVAC, roof leak)
   - Expected: Dashboard shows properties/cases/contractors but NO tenants/entities sections
   - Test: Verify simplified view without tenant/entity complexity

5. **Contractor 1 (Plumber)**
   - Email: `contractor1@test.com`
   - Role: contractor
   - Specialty: Plumber (Tier 1)
   - Expected: Redirects to /contractor-dashboard, sees only plumbing jobs in marketplace
   - Test: Maya AI scoped to job context only (NO portfolio/financial data)

6. **Contractor 2 (HVAC Technician)**
   - Email: `contractor2@test.com`
   - Role: contractor
   - Specialty: HVAC Technician (Tier 1)
   - Expected: Redirects to /contractor-dashboard, sees only HVAC jobs in marketplace
   - Test: Verify specialty-based filtering works correctly

**Pending Work:**
- Contractor team management (optional)
- Execute comprehensive systematic testing with test accounts
- Consider refactoring PropertyOwnerSignup to use react-hook-form pattern for consistency