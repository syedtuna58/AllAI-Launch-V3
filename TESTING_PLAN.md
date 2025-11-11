# Comprehensive Multi-User Testing Plan

## Overview
This document provides step-by-step guidance for testing all 5 user types in the AllAI Property Management Platform. Follow each phase in order to ensure complete system validation.

---

## Phase 1: Platform Super Admin Testing

### Setup
1. Navigate to the landing page
2. Log in as Platform Admin (or have one created via backend)

### Test Cases

#### TC1.1: Admin Dashboard Access
- **Steps**: Log in and access `/admin-dashboard`
- **Expected**: Dashboard shows all organizations, all users, system statistics
- **Verify**: Can see data across ALL organizations

#### TC1.2: View All Organizations
- **Steps**: Check organizations list
- **Expected**: See all orgs including those owned by landlords and property owners
- **Verify**: Organization count is accurate, owner types are visible

#### TC1.3: View All Users
- **Steps**: Browse users list
- **Expected**: See users with all roles (platform_super_admin, org_admin, property_owner, contractor, tenant)
- **Verify**: User roles are correctly displayed

#### TC1.4: System Analytics
- **Steps**: Review dashboard stats
- **Expected**: Total properties, total users, total cases displayed
- **Verify**: Numbers reflect cross-org aggregation

---

## Phase 2: Landlord (Org Admin) Testing

### Setup
1. Log out from admin account
2. Use magic link login for landlord account

### Test Cases

#### TC2.1: Landlord Dashboard Access
- **Steps**: Log in and access `/landlord-dashboard`
- **Expected**: Dashboard shows properties, tenants, active cases
- **Verify**: Only sees data from their organization

#### TC2.2: View Properties
- **Steps**: Check properties section
- **Expected**: List of landlord's properties with unit counts
- **Verify**: Cannot see properties from other organizations

#### TC2.3: Tenant Management
- **Steps**: Navigate to tenants section
- **Expected**: See list of tenants across all properties
- **Verify**: Tenant count matches expected

#### TC2.4: Invite Tenant
- **Steps**: Click "Invite Tenant" button, select unit, enter tenant email
- **Expected**: Tenant invitation email sent (check console logs if SendGrid not configured)
- **Verify**: 
  - Email contains verification link: `/auth/verify-tenant?token=...&tenantId=...`
  - Tenant record created with `invited` status
  - Email address stored correctly

#### TC2.5: View Maintenance Cases
- **Steps**: Check active cases section
- **Expected**: See cases for landlord's properties only
- **Verify**: Urgent cases highlighted, status badges correct

#### TC2.6: Contractor Favorites
- **Steps**: Browse contractor marketplace, add favorite
- **Expected**: Contractor added to favorites list
- **Verify**: Favorite persists, can be removed

---

## Phase 3: Property Owner Testing

### Setup
1. Open new incognito window
2. Navigate to property owner signup (or create signup page)
3. Sign up with new email

### Test Cases

#### TC3.1: Property Owner Signup
- **Steps**: POST to `/api/auth/signup-property-owner` with firstName, lastName, email
- **Expected**: Verification email sent
- **Verify**: Email contains link: `/auth/verify-property-owner?token=...`

#### TC3.2: Email Verification
- **Steps**: Click verification link from email
- **Expected**: 
  - User account created with role `property_owner`
  - Personal organization created with `ownerType: 'property_owner'`
  - Organization membership created
  - Session created and returned
- **Verify**: User is logged in and redirected to dashboard

#### TC3.3: Property Owner Dashboard Access
- **Steps**: Access `/property-owner-dashboard`
- **Expected**: Dashboard shows properties, cases, favorites
- **Verify**: 
  - NO tenant management section
  - NO entity tracking
  - NO financial portfolio features

#### TC3.4: Add Property
- **Steps**: Click "Add Property" button, fill details
- **Expected**: Property created and linked to property owner's personal org
- **Verify**: Property appears in dashboard

#### TC3.5: Create Maintenance Request
- **Steps**: Click "New Request", create maintenance case
- **Expected**: Case created for property owner's property
- **Verify**: Case appears in recent cases section

#### TC3.6: Browse Contractor Marketplace
- **Steps**: Click "Browse Contractors"
- **Expected**: See list of contractors with specialties
- **Verify**: Can filter by specialty, see contractor profiles

#### TC3.7: Add Favorite Contractor
- **Steps**: Select contractor, add to favorites
- **Expected**: Contractor added to favorites list
- **Verify**: 
  - POST to `/api/property-owner/favorites` with `contractorUserId`
  - Favorite persists in dashboard
  - Can remove favorite

---

## Phase 4: Tenant Testing

### Setup
1. Use tenant invitation from Phase 2 (TC2.4)
2. Click verification link from email

### Test Cases

#### TC4.1: Tenant Email Verification
- **Steps**: Click link from tenant invite email
- **Expected**: 
  - Token validated
  - Token email matches tenant email (security check)
  - User account created (or linked if exists)
  - Tenant record linked to user
  - Session created
- **Verify**: User logged in as tenant

#### TC4.2: Tenant Dashboard Access
- **Steps**: Access `/tenant-dashboard-new`
- **Expected**: Dashboard shows tenant's unit and cases
- **Verify**: 
  - Can see their unit details
  - Can see their property information (address only)
  - Cannot see other tenants' data

#### TC4.3: Submit Maintenance Request
- **Steps**: Click "Submit Request", fill form
- **Expected**: Maintenance case created for tenant's unit
- **Verify**: 
  - Case appears in tenant dashboard
  - Case appears in landlord dashboard (Phase 2 verification)

#### TC4.4: View Case Status
- **Steps**: Check submitted cases
- **Expected**: See status (pending, assigned, in_progress, completed)
- **Verify**: Status updates reflect actual case state

#### TC4.5: Data Isolation Check
- **Steps**: Try to access other tenant data (manual API test)
- **Expected**: RBAC blocks access to other tenants' cases/units
- **Verify**: 403/404 errors for unauthorized access

---

## Phase 5: Contractor Testing

### Setup
1. Log out and navigate to `/contractor-signup`
2. Complete contractor signup flow

### Test Cases

#### TC5.1: Contractor Signup - Email
- **Steps**: Enter email, submit
- **Expected**: Magic link sent to email
- **Verify**: Email contains verification link

#### TC5.2: Contractor Signup - SMS
- **Steps**: Click magic link, enter phone number
- **Expected**: SMS verification code sent via Twilio
- **Verify**: 
  - Twilio connector sends actual SMS
  - 6-digit code received

#### TC5.3: SMS Verification
- **Steps**: Enter 6-digit code
- **Expected**: Phone verified, proceed to specialty selection
- **Verify**: Code validation works, retries limited

#### TC5.4: Specialty Selection
- **Steps**: Browse 60 specialties across 6 tiers, select 1-3
- **Expected**: Specialties saved to contractor profile
- **Verify**: 
  - Can select multiple specialties
  - Selections persist

#### TC5.5: Contractor Dashboard Access
- **Steps**: Access `/contractor-dashboard`
- **Expected**: Dashboard shows marketplace jobs and assigned jobs
- **Verify**: 
  - Marketplace filtered by contractor specialties
  - No landlord/portfolio data visible

#### TC5.6: Job Marketplace Visibility
- **Steps**: Check available jobs in marketplace
- **Expected**: ONLY see jobs matching contractor specialties
- **Verify**: 
  - Plumber sees plumbing jobs
  - Electrician sees electrical jobs
  - No cross-specialty leakage

#### TC5.7: Accept Job from Marketplace
- **Steps**: Click "Accept" on marketplace job
- **Expected**: 
  - Job moved from marketplace to assigned jobs
  - Job removed from marketplace for other contractors
  - Status updated to "assigned"
- **Verify**: Job appears in "My Jobs" section

#### TC5.8: Maya AI - Job Context Only
- **Steps**: Use Maya AI to ask about a job
- **Expected**: Maya responds with job-specific help
- **Verify**: 
  - Maya has access to job details (address, description, priority)
  - Maya does NOT have access to property financials
  - Maya does NOT have access to landlord portfolio data

---

## Phase 6: Security & Data Isolation Testing

### Test Cases

#### TC6.1: Cross-Org Access Block (Contractor)
- **Steps**: Contractor tries to access `/api/landlord/properties` (manual API call)
- **Expected**: 403 Forbidden - RBAC blocks access
- **Verify**: `requireRole(['org_admin'])` enforces role check

#### TC6.2: Cross-Org Access Block (Tenant)
- **Steps**: Tenant tries to access other tenant's cases (manual API call)
- **Expected**: Empty array or 404 - org scoping prevents leakage
- **Verify**: Database queries filter by org membership

#### TC6.3: Cross-Org Access Block (Property Owner)
- **Steps**: Property owner tries to access landlord tenant routes
- **Expected**: 403 Forbidden or empty data
- **Verify**: Property owners isolated from tenant management features

#### TC6.4: Token Replay Attack Prevention (Tenant)
- **Steps**: Use valid tenant invite token with different `tenantId`
- **Expected**: 403 error - email mismatch detected
- **Verify**: `verificationToken.email !== tenant.email` check works

#### TC6.5: Contractor Maya AI Assignment Check
- **Steps**: Contractor requests Maya context for unassigned case
- **Expected**: Access denied - no job context returned
- **Verify**: `caseData.assignedContractorId !== userId` blocks access

#### TC6.6: Session Management
- **Steps**: 
  - Log in, verify session created
  - Use refresh token to renew session
  - Log out, verify session cleared
- **Expected**: 
  - Session persists across requests
  - Refresh token works
  - Logout clears localStorage and invalidates session

---

## Phase 7: Integration Testing

### Test Cases

#### TC7.1: End-to-End Tenant Flow
1. Landlord invites tenant
2. Tenant receives email, verifies
3. Tenant creates maintenance case
4. Case appears in landlord dashboard
5. Landlord assigns contractor
6. Contractor sees job in dashboard

#### TC7.2: End-to-End Property Owner Flow
1. Property owner signs up
2. Adds first property
3. Creates maintenance request
4. Browses contractors
5. Adds favorite contractor
6. Creates job and assigns to favorite

#### TC7.3: Contractor Marketplace Flow
1. Landlord creates case with specialty requirement
2. Case appears in matching contractors' marketplace
3. Contractor accepts job
4. Case removed from marketplace
5. Job appears in contractor's assigned jobs

---

## Known Limitations & Notes

### Email Service
- **Status**: SendGrid not configured (user dismissed setup)
- **Workaround**: Email content logs to console - check workflow logs
- **Impact**: Magic links and tenant invites won't send actual emails
- **Solution**: Copy link from console logs to test verification flow

### SMS Service
- **Status**: Twilio configured via Replit connector
- **Impact**: Real SMS sent during contractor signup
- **Cost**: Verify SMS costs before extensive testing

### Database
- **Environment**: Development database only
- **Impact**: Cannot test production database operations
- **Security**: All destructive SQL blocked in development

### Frontend WebSocket
- **Issue**: WebSocket connection errors in browser console
- **Impact**: Live notifications may not work
- **Status**: Non-blocking, does not affect core functionality

---

## Success Criteria

### All Phases Complete When:
- ✅ Platform admin can view all orgs/users
- ✅ Landlords can manage properties, tenants, cases
- ✅ Property owners can manage personal properties (no tenant features)
- ✅ Tenants can submit cases and view their unit
- ✅ Contractors can browse specialty-matched jobs
- ✅ Data isolation verified (no cross-org leakage)
- ✅ Security checks passed (RBAC, token validation)
- ✅ Session management works (login, refresh, logout)
- ✅ Maya AI scoping verified for all roles

---

## Testing Tips

1. **Use Incognito Windows**: Test multiple roles simultaneously without logout
2. **Check Console Logs**: Email verification links appear in workflow logs
3. **Test Data Isolation**: Always verify users can't see other orgs' data
4. **Security First**: Try to bypass RBAC manually - it should block you
5. **Document Issues**: Note any bugs or unexpected behavior for fixes

---

## Quick Start Guide for User

As a user, here's the fastest way to test the platform:

### Step 1: Test Platform Admin (5 min)
1. Log in as admin
2. Check you can see all orgs and users
3. Verify cross-org visibility

### Step 2: Test Landlord (10 min)
1. Log in as landlord (magic link)
2. Invite a tenant (copy email link from logs)
3. Add a property
4. Create a maintenance case
5. Add favorite contractor

### Step 3: Test Property Owner (15 min)
1. Sign up as property owner (new email)
2. Verify email (copy link from logs)
3. Add first property
4. Create maintenance request
5. Browse and favorite contractors
6. Verify NO tenant/entity features visible

### Step 4: Test Tenant (10 min)
1. Use tenant invite from Step 2
2. Verify email
3. Check unit details
4. Submit maintenance request
5. Verify landlord sees the case

### Step 5: Test Contractor (15 min)
1. Sign up at `/contractor-signup`
2. Verify email (copy link from logs)
3. Verify phone with SMS code (real SMS sent!)
4. Select specialties (e.g., Plumber)
5. Check marketplace (should only see plumbing jobs)
6. Accept a job
7. Verify job moved to "assigned"

### Step 6: Security Checks (10 min)
- Try accessing other users' data manually
- Verify RBAC blocks unauthorized routes
- Test session refresh and logout

**Total Time: ~1 hour for complete testing**

---

## Next Steps After Testing

1. **Document Bugs**: Create list of any issues found
2. **Performance**: Note any slow API calls or UI lag
3. **UX Improvements**: Suggest usability enhancements
4. **Production Readiness**: 
   - Configure SendGrid for real emails
   - Migrate refresh tokens to httpOnly cookies
   - Add rate limiting on auth endpoints
   - Set up monitoring and alerting

---

## Support

If you get stuck during testing:
1. Check workflow logs for email verification links
2. Verify database has required data (users, orgs, properties)
3. Confirm you're logged in with correct role
4. Try clearing localStorage and logging in again

Happy testing! 🎉
