# VERO SafeGuard — Docker Setup

## Quick Start

```bash
git clone <repo-url>
cd VERO_SafeGuard
docker compose up --build
```

First build takes 2–3 minutes. Subsequent starts are fast.

| URL | Service |
|---|---|
| http://localhost | Rider PWA |
| http://localhost:8080 | Admin Dashboard |
| http://localhost:8000/docs | Backend API (Swagger) |

## Stop

```bash
docker compose down
```

Fresh start (wipes database):

```bash
docker compose down -v
docker compose up --build
```

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View one service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Restart one service
docker compose restart backend
```

## Troubleshooting

**Port 80 in use** — change frontend port in `docker-compose.yml`:
```yaml
frontend:
  ports:
    - "3000:80"
```

**Port 8080 in use** — change admin dashboard port:
```yaml
admin-dashboard:
  ports:
    - "8081:80"
```

**Backend keeps restarting** — database not ready yet. Wait 30 seconds or run:
```bash
docker compose down -v && docker compose up --build
```

**Missing .env file** — copy the example:
```bash
cp .env.example .env
```
The defaults work for local Docker runs without any edits.

## Architecture

```
http://localhost          http://localhost:8080
      │                          │
      ▼                          ▼
 Rider PWA (port 80)    Admin Dashboard (port 8080)
      │                          │
      └──────────┬───────────────┘
                 │  /api/*  (nginx proxy)
                 ▼
         Backend API (port 8000)
         FastAPI + ML Engine
                 │
                 ▼
         PostgreSQL (port 5432, internal)
```
