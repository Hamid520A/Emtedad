# 🚨 Emtedad Enterprise Runbook

This document is the authoritative operations guide for the Emtedad Contest Platform. It provides emergency response, disaster recovery (DR), and observability protocols for SREs and Operations teams.

---

## 🔍 1. Incident Response & Troubleshooting

### Incident: Users trapped in Eitaa WebView cannot download files
**Symptom:** Users click "Download Certificate" or "View Attachment" but nothing happens or the WebView silently fails.
**Root Cause:** Embedded WebViews block standard `blob:` downloads and lack native intent interpreters.
**Resolution Steps:**
1. Verify the `?download=true` middleware is active on the backend route.
2. Confirm the frontend is using the robust `openExternalLink` hatch with `target="_top"` in `lib/utils/url.ts`.
3. If users still cannot open PDFs, ensure the Google Docs Viewer proxy is active and appending the anti-CDN cache-buster (`?cb=<timestamp>`).

### Incident: Exam Submissions Failing / Deadlocks
**Symptom:** HTTP 500 errors during `POST /submit_exam` or users complaining their answers aren't saved.
**Root Cause:** Concurrent requests overloading the DB transaction pool, or race conditions attempting to create duplicate subscriptions.
**Resolution Steps:**
1. **Check DB Locks:** Run `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';` on PostgreSQL.
2. **Verify Unique Constraints:** Ensure the backend `UniqueConstraint('user_id', 'contest_id')` is intact on the `subscriptions` table.
3. **Rollback Rogue Transactions:** If deadlocks persist, restart the backend container to clear the SQLAlchemy connection pool:
   ```bash
   docker-compose restart backend
   ```

---

## 🏥 2. Disaster Recovery (DR)

### Scenario A: Database Crash or Corruption
In the event of catastrophic database failure or table corruption, execute a point-in-time recovery using the automated pg_dumps.

**1. Isolate the Environment:**
```bash
docker-compose stop backend frontend-user frontend-admin
```
**2. Drop and Recreate the Database (Data Loss Warning):**
```bash
docker exec -it emtedad_db psql -U postgres -c "DROP DATABASE emtedad;"
docker exec -it emtedad_db psql -U postgres -c "CREATE DATABASE emtedad;"
```
**3. Restore from Latest Backup:**
```bash
docker exec -i emtedad_db psql -U postgres -d emtedad < /backups/latest_dump.sql
```
**4. Bring Services Online:**
```bash
docker-compose start
```

### Scenario B: Complete Docker Host Failure
If the bare-metal or cloud instance fails completely:
1. Spin up a new host instance with Docker and Docker Compose installed.
2. Pull the latest repository configuration.
3. Mount the remote block storage containing the PostgreSQL data volume (`pgdata`) and media uploads (`static`).
4. Execute `docker-compose up -d --build`.

---

## 📡 3. Observability & Logs

Use the following CLI commands to monitor the live cluster health and diagnose active faults.

### Check Overall Cluster Health:
```bash
docker-compose ps
docker stats
```

### Tail Live Backend (FastAPI) Logs:
Watch for HTTP 500s, SQLAlchemy transaction errors, or dropped connections:
```bash
docker-compose logs -f --tail=100 backend
```

### Tail Live Frontend Logs:
Monitor Next.js SSR crashes or build errors:
```bash
# User App
docker-compose logs -f --tail=100 frontend-user

# Admin Panel
docker-compose logs -f --tail=100 frontend-admin
```

---

## ⏪ 4. Standard Rollback Plan

If a new deployment introduces P0 regressions (e.g., routing crashes, broken authentication), follow this rollback procedure immediately:

**1. Identify the Last Known Good Commit:**
```bash
git log --oneline
```
**2. Hard Reset the Repository:**
```bash
git reset --hard <LAST_GOOD_COMMIT_HASH>
```
**3. Rebuild and Force Redeploy Containers:**
```bash
# The -V flag removes anonymous volumes which might hold bad state
docker-compose down -v
docker-compose up -d --build
```
**4. Verify Health:**
Tail the backend logs to ensure migrations and the server started cleanly.
```bash
docker-compose logs -f backend
```
