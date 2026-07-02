# MartPay

> **Scan. Pay. Go.**

MartPay is a high-performance, enterprise-ready self-checkout platform for modern supermarkets. It provides a mobile customer application, an exit gate verification portal, and a secure backend service to orchestrate self-purchasing flows with military-grade safety parameters.

---

## 1. System Architecture Overview

We utilize a **Clean Architecture** framework separation pattern:

- **Domain Layer**: Independent core interfaces, entities, and validation models.
- **Use Case / Service Layer**: Flow controllers implementing transaction processing, QR code signature builders, and token lifecycles.
- **Infrastructure / Database Layer**: Implemented via PostgreSQL and Prisma ORM, Redis for cached blocklists, and Winston for logging.
- **Presentation Layer**: Versioned REST API using NestJS modules and controllers.

```
MartPay/
├── package.json                   # Workspace workspace definitions
├── docker-compose.yml             # Postgres, Redis, and NestJS orchestration
├── RULEBOOK/
│   └── AI_RULEBOOK.md             # Security and encryption mandates
├── backend/                       # NestJS API Backend
└── mobile/                        # Flutter Mobile Frontend
```

---

## 2. Security Hardening

- **Cryptographic QR Exit Passes**: QR codes contain only the `orderId`, an execution `timestamp`, and a timing-safe `HMAC-SHA256` token signature. QR tokens expire in 3 minutes.
- **Replay Attack Defense**: Single-use status updates prevent duplicate checkout pass scans.
- **Data Protection**: Zero raw database logs exposed. Global interceptors strip low-level errors before returning them to client views.
- **Rate-Limiting**: Enforced rate limits prevent DoS attacks.

---

## 3. Quickstart Guide

### Pre-requisites
- Docker & Docker Compose
- Node.js (v18+) & NPM

### Spin up Environment
To start the database, cache, and backend inside containers:
```bash
# In the root directory
npm run docker:up
```

### Local Dev Environment Setup

#### 1. Setup Backend
```bash
cd backend
npm install
# Configure your local .env using .env.example
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

#### 2. Setup Mobile
```bash
cd mobile
flutter pub get
flutter run
```

---

## 4. API Endpoints (v1)

- **GET** `/api/v1/health` - Infrastructure verification.
- **POST** `/api/v1/auth/register` - User registration.
- **POST** `/api/v1/auth/login` - User authentication.
- **GET** `/api/v1/products/scan/:barcode` - Product barcode scanner resolver.
- **POST** `/api/v1/orders` - Order placement.
- **POST** `/api/v1/orders/:id/pay` - Checkout processing.
- **POST** `/api/v1/orders/verify-exit` - Gate controller exit checking.
- **GET** `/api/v1/admin/audit-logs` - System access trails logs.
