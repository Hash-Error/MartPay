# AI Rulebook - MartPay

This rulebook defines the development guidelines, architectural rules, and security rules for the **MartPay** project.

## Tagline
**Scan. Pay. Go.**

## Mission
Build a production-ready, enterprise-grade self-checkout platform for supermarkets where customers scan products using their smartphones, pay digitally, receive a secure QR code, and exit after verification.

---

## Project Rules

1. **Production-Ready**: Never generate temporary or demo code. Every feature must be production-ready.
2. **Architecture**: Follow Clean Architecture and SOLID principles. Write modular, reusable code.
3. **Secrets Management**: Never hardcode secrets. Use environment variables.
4. **Input Validation**: Validate every user input and sanitize all data.
5. **Injection Protection**: Protect against SQL/NoSQL Injection and Cross-Site Scripting (XSS).
6. **Web Security**: Protect against Cross-Site Request Forgery (CSRF) and replay attacks.
7. **QR Code Security**: Protect against QR cloning. QR codes must never store product details directly.
8. **Encryption**: Encrypt sensitive information and use HTTPS everywhere.
9. **Authentication**:
   - Store passwords using Argon2 or bcrypt.
   - Use JWT Access + Refresh Tokens.
   - Implement Role-Based Access Control (RBAC).
10. **Audit & Logging**: Log security events.
11. **Error Handling**: Never expose internal errors to users. Handle all errors gracefully.
12. **API Design**: Use API versioning and follow REST API best practices.
13. **Documentation**: Write maintainable documentation.
14. **Testing**: Every module must include tests.
15. **No Shortcuts**: Never remove security features for convenience.

---

## Security Rules

- **QR Code Content Constraints**:
  - QR codes must **never** store product details.
  - QR codes must contain **only**:
    - Order ID
    - Signed Token (digitally signed)
    - Timestamp
  - Every QR code must expire after a short time (e.g., 2–5 minutes).
- **Payment Verification**: Payment must always be verified from the server.
- **Authentication Requirement**: Every API request requires authentication.
- **Data Protection**: Sensitive data must be encrypted.
- **Communication Security**: All communication must use TLS.
- **Transaction Integrity**: Prevent duplicate payments.
- **Audit Trails**: Maintain complete audit logs and detect suspicious activity.

---

## Coding Rules

- Write highly readable code.
- Use descriptive variable, function, and class names.
- Comment only where necessary to explain intent, not obvious mechanics.
- Build reusable, decoupled components.
- Never duplicate logic.
- Use asynchronous operations (`async/await`) when appropriate.
- Follow REST API best practices (semantic HTTP methods, proper status codes, standardized JSON responses).
