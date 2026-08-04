# Security Considerations

**Last Updated:** 2026-08-02  
**Status:** Active Documentation

This document records known security considerations, trade-offs, and mitigations in the Garment ERP system.

---

## Table of Contents

1. [Token Storage (BUG-AUTH9)](#1-token-storage-bug-auth9)
2. [Existing Security Stack](#2-existing-security-stack)
3. [Future Hardening Recommendations](#3-future-hardening-recommendations)

---

## 1. Token Storage (BUG-AUTH9)

### Issue

JWT tokens are stored in `localStorage` via the Zustand auth store (`frontend/src/stores/auth.store.ts`). This storage mechanism is accessible to any JavaScript running on the page, creating a potential XSS (Cross-Site Scripting) attack vector.

**Attack Scenario:** If an attacker successfully injects malicious JavaScript into the application (via XSS), they can:
1. Read `localStorage.getItem('auth-storage')`
2. Extract the JWT token
3. Impersonate the user until the token expires (7 days)

### Mitigations in Place

| Layer | Mitigation | Location |
|-------|------------|----------|
| **HTTP Headers** | Helmet.js security headers (CSP, X-XSS-Protection, etc.) | `backend/src/app.ts` |
| **Input Validation** | All inputs validated via Zod schemas | `backend/src/schemas/*.schema.ts` |
| **Output Encoding** | React auto-escapes rendered content | Built into React |
| **Token Expiry** | 7-day token lifetime limits damage window | `backend/src/utils/jwt.utils.ts` |
| **Account Re-validation** | Every request re-checks user status in DB | `backend/src/middleware/auth.middleware.ts:29-48` |
| **Error Scrubbing** | Sentry removes tokens from error reports | `frontend/src/lib/sentry.ts:76-80` |
| **Rate Limiting** | Auth endpoints limited to 5 req/15 min | `backend/src/middleware/security.middleware.ts` |

### Why Not httpOnly Cookies?

The alternative to localStorage is httpOnly cookies, which are not accessible to JavaScript. However, this architecture was not chosen for several reasons:

| Factor | localStorage (Current) | httpOnly Cookies |
|--------|------------------------|------------------|
| **XSS Protection** | Vulnerable (mitigated) | Protected |
| **CSRF Protection** | Protected (no cookies) | Vulnerable (needs CSRF tokens) |
| **CORS Complexity** | Simple Bearer header | Requires credentials, SameSite, Secure |
| **Multi-Origin** | Works across origins | Complex with subdomains |
| **Multi-Client** | Same API for B2B app, mobile | Each client type needs different handling |
| **Development** | Frontend:3000, Backend:5000 works | Cookie domain issues in dev |

**Key Insight:** Neither approach is inherently "more secure" - they protect against different attack vectors. The current architecture prioritizes:
1. Simplicity for SPA + API server separation
2. Compatibility with the B2B sales app (separate codebase, same API)
3. Future mobile app compatibility
4. CSRF immunity (stateless authentication)

### Risk Assessment

| Risk | Severity | Likelihood | Mitigation Status |
|------|----------|------------|-------------------|
| XSS leading to token theft | High | Low (React escaping + CSP) | Mitigated |
| Token extracted from browser tools | Medium | Low (requires physical access) | Accepted |
| Token in browser history/logs | Low | Low | Not applicable (not in URLs) |

### Recommended Future Hardening

1. **Refresh Token Pattern**
   - Store short-lived access tokens (15 min) in memory only
   - Store refresh token in httpOnly cookie
   - Access token theft has very limited window
   
2. **Token Fingerprinting**
   - Bind tokens to browser characteristics (User-Agent, screen, etc.)
   - Reject tokens used from different fingerprints
   
3. **Anomaly Detection**
   - Monitor for tokens used from multiple IPs simultaneously
   - Alert on unusual access patterns

---

## 2. Existing Security Stack

### Authentication

- **Password Hashing:** bcrypt with 12 salt rounds (`backend/src/config/security.config.ts`)
- **JWT Algorithm:** HS256 (HMAC-SHA256)
- **Token Expiry:** 7 days
- **Account Approval:** New users require admin approval before login

### Authorization

- **RBAC:** 9 user roles with granular permissions
- **Backend Enforcement:** `authorize()` middleware on protected routes
- **Frontend Enforcement:** Permission checks hide unauthorized UI elements
- **Per-Request Validation:** User status re-checked on every authenticated request

### Input/Output Security

- **Input Validation:** Zod schemas on all POST/PUT/PATCH routes
- **SQL Injection:** Prevented via Prisma ORM (parameterized queries)
- **XSS Output:** React auto-escaping + Content-Security-Policy
- **Serialization:** Controlled output via serializer (`backend/src/utils/serializer.ts`)

### Network Security

- **HTTPS:** Required in production (enforced at infrastructure level)
- **CORS:** Configured whitelist of allowed origins
- **Rate Limiting:** Auth endpoints (5/15min), general API (100/min)
- **Helmet.js:** Security headers (CSP, HSTS, X-Frame-Options, etc.)

---

## 3. Future Hardening Recommendations

### Priority 1: Short-term (Next Quarter)

- [ ] Implement refresh token pattern with httpOnly cookie for refresh token
- [ ] Add password breach checking (HaveIBeenPwned API)
- [ ] Implement account lockout after N failed login attempts

### Priority 2: Medium-term (6 Months)

- [ ] Add two-factor authentication (TOTP) for admin accounts
- [ ] Implement audit logging for sensitive operations
- [ ] Add session management UI (view/revoke active sessions)

### Priority 3: Long-term (1 Year)

- [ ] Security audit by external firm
- [ ] Penetration testing
- [ ] SOC 2 compliance preparation (if required by enterprise clients)

---

## Related Documentation

- [SECURITY_GUIDE.md](archive/legacy-feb-2026/SECURITY_GUIDE.md) - Full authentication/authorization guide
- `backend/src/middleware/auth.middleware.ts` - Token verification
- `backend/src/config/permissions.config.ts` - Role permissions matrix
- `frontend/src/stores/auth.store.ts` - Token storage implementation

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-08-02 | Claude | Initial documentation for BUG-AUTH9 |
