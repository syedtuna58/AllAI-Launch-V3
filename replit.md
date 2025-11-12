# AllAI Property Management Platform

## Overview
AllAI Property is a comprehensive platform for part-time landlords and small property management companies. It enables users to track properties, manage tenants, monitor maintenance, handle expenses, and stay organized with automated reminders. The platform supports various user types including platform super admins, organization admins (landlords), property owners, contractors, and tenants, each with role-based access control. Its goal is to provide an intuitive interface for managing real estate portfolios, including features like ownership entity management, smart case tracking, and automated regulatory compliance.

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