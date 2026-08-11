# 🏆 Emtedad Contest & Exam Platform

**Emtedad** is an enterprise-grade, highly scalable platform designed to host, manage, and execute digital contests and examinations. Engineered with a robust backend and a dual-frontend architecture, the platform securely serves both administrative operators and end-users, specifically optimized for deployment within strict WebViews (such as the Eitaa Mini-App ecosystem).

---

## 🏗 Architecture Overview

The system architecture is decoupled into three primary layers:
1. **Core API Backend**: A high-performance RESTful API managing business logic, secure transactions, and state.
2. **Admin Panel**: A comprehensive dashboard for contest creation, user management, and real-time analytics.
3. **User Mini-App**: A lightweight, resilient interface tailored for end-users, built to bypass rigid CDN caches and restricted WebView constraints.

```mermaid
graph TD;
    Client_User[User Mini-App (Eitaa WebView)] -->|REST API| API[FastAPI Backend]
    Client_Admin[Admin Panel Web] -->|REST API| API
    
    API -->|Read/Write| DB[(PostgreSQL)]
    
    subgraph Edge Layer
        CDN[CDN / Object Storage] -.->|Cache-busted Docs/Media| Client_User
        External[Aparat/Video Services] -.->|Fallback Intents| Client_User
    end
```

---

## 💻 Technology Stack

### Backend
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
* **ORM & Database:** SQLAlchemy + PostgreSQL
* **Authentication:** JWT (JSON Web Tokens) with strict RBAC (Role-Based Access Control)
* **Containerization:** Docker & Docker Compose

### Frontend (Admin & User)
* **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19)
* **Styling:** Tailwind CSS (v4)
* **State & Data Fetching:** React Hooks, Axios
* **Icons & UI:** Lucide React, Recharts (for Admin Analytics)

---

## 🚀 Prerequisites & Setup

### 1. Environment Configuration
Duplicate the provided example environment file and configure your local secrets (Database credentials, JWT secret keys, etc.):
```bash
cp .env.example .env
```

### 2. Running with Docker Compose
The entire stack (PostgreSQL, Backend API, and both Frontends) is fully containerized. Start the platform with a single command:
```bash
docker-compose up -d --build
```

* **Backend API:** Available at `http://localhost:8000`
* **Admin Panel:** Available at `http://localhost:3000` (or as configured in compose)
* **User App:** Available at `http://localhost:3001` (or as configured in compose)

---

## 🛡 Critical Architectural Highlights

The platform has undergone rigorous auditing to ensure zero-trust security, absolute data integrity, and cross-platform resilience:

* **Strict Server-Side Grading (Anti-Spoofing):** 
  The backend employs a zero-trust model. Client payloads are never trusted for score calculations. All exam answers are cross-referenced with the database source of truth, guaranteeing tamper-proof grading.
* **Atomic Database Transactions & Race-Condition Immunity:** 
  Critical endpoints (like `submit_exam`) wrap logic in single, atomic SQLAlchemy transactions. Schema-level constraints (`UniqueConstraint('user_id', 'contest_id')`) eradicate double-submission race conditions.
* **Advanced WebView Resilience (Eitaa Compatibility):** 
  * **Iframe Constraints:** Video embeds (e.g., Aparat) are fortified with standard HTML5 fullscreen fallbacks, overcoming native `WebChromeClient` limitations in embedded browsers.
  * **CDN Cache-Busting:** Google Docs Viewers and aggressive caching layers are bypassed using dynamic timestamp query injection (`?cb=...`), guaranteeing users always receive the latest exam assets.
  * **Dual-Flag URL Downloading:** Implements universal DOM-based navigation (`target="_top"`) and intent schemes to force native browser behavior when restricted WebViews intercept `blob:` downloads.
* **OOM (Out-Of-Memory) Protection:** 
  Scheduled tasks and status updates avoid unbound memory loading (e.g., Python `for` loops on large tables) in favor of optimized bulk SQL `UPDATE` operations.

---
*Maintained by the Emtedad Core Engineering Team.*
