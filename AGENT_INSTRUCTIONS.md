# Emtedad Project - Architecture & Agent Guidelines

You are an expert Principal Engineer and AI Assistant working on the "Emtedad" project.
Read these core rules BEFORE executing any code modification, refactoring, or feature addition.

## 1. Tech Stack Overview
- **Backend**: Python, FastAPI, SQLAlchemy 2.0, Pydantic V2, PostgreSQL 15, Redis 7 (Dual instances: 6379 for Rate Limits, 6389 for Eitaa Sessions).
- **Frontend (User & Admin)**: Next.js (App Router), TailwindCSS, Recharts.
- **Infrastructure**: Docker Compose (Strictly containerized).

## 2. Core Architectural Constraints (STRICT)
- **Anti-Cheat Logic**: The `is_correct` field for Questions must NEVER be exposed in the frontend JSON response during an active exam. Verification happens strictly server-side.
- **N+1 Query Prevention**: When using SQLAlchemy, always use `joinedload` or `selectinload` for relational data (e.g., loading Questions with their Options). DO NOT write lazy-loaded queries in loops.
- **Dual Authentication**: Users and Admins are strictly separated. Admins use the `admins` table. Never mix user and admin authentication flows.
- **Time/Timezone**: All database timestamps and exam calculations must be handled robustly. The project relies on `jdatetime` for Shamsi (Jalali) calendar calculations where necessary.

## 3. Code Generation Rules (Token Optimization)
- **Do not output the entire file** if you are only changing a few lines. Use precise code blocks indicating where the change happens (e.g., `// ... existing code ...`).
- **No Hallucinations**: If you need to know a database model structure, use your file search tool to read `backend/app/models.py` or `schemas.py` BEFORE writing the code. Do not guess the schema.
- **Pydantic V2**: Ensure all backend schemas use Pydantic V2 syntax (e.g., `model_config` instead of `Config`, `Field` imports from `pydantic`).

## 4. Eitaa Bridge Integration
- The project runs a mini-app inside the Eitaa messenger. Redis 6389 manages these sessions.
- Do not modify the `/proxy-upload` or Eitaa synchronization logic without explicit instructions, as it handles hardware IMEI and token verification.

## 5. UI/UX Standard
- Next.js components should use Tailwind CSS.
- For Admin analytics, stick to `Recharts`.
- Components must be responsive and handle mobile-first layouts, as the primary client is a mobile messenger mini-app (Eitaa).