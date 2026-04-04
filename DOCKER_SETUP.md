# VERO - Docker Setup Guide

## Quick Start (3 Steps)

### 1. Make sure Docker Desktop is running
- Open Docker Desktop on Windows
- Wait for it to fully start

### 2. Build and start all services
Open terminal in the `new_repo` folder and run:
```bash
docker compose up --build
```

### 3. Access the application
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs


## What's Running?

- **PostgreSQL Database** (internal, port 5432)
- **Backend API** (FastAPI on port 8000)
- **Frontend** (React + Vite on port 80)

## Useful Commands

### Stop all services
```bash
docker compose down
```

### Stop and remove all data (fresh start)
```bash
docker compose down -v
```

### View logs
```bash
docker compose logs -f
```

### View specific service logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Restart a specific service
```bash
docker compose restart backend
docker compose restart frontend
```

## Troubleshooting

### Port already in use
If port 80 or 8000 is already in use, stop the conflicting service or change ports in `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "3000:5173"  

backend:
  ports:
    - "8001:8000"  
```

### Database connection issues
```bash
# Check if database is healthy
docker compose ps

# Restart database
docker compose restart db

# Fresh database
docker compose down -v
docker compose up --build
```

### Frontend not loading
```bash
# Check frontend logs
docker compose logs -f frontend

# Rebuild frontend
docker compose up --build frontend
```

## Development Mode

The setup includes hot-reload for both frontend and backend:
- **Frontend**: Changes to files in `frontend/src/` will auto-refresh
- **Backend**: Changes to files in `backend/app/` will auto-reload

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser (http://localhost)             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Frontend Container (React + Vite)      │
│  Port: 80 → 5173                        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Backend Container (FastAPI)            │
│  Port: 8000                             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  PostgreSQL Container                   │
│  Port: 5432 (internal only)             │
└─────────────────────────────────────────┘
```

## Next Steps

1. Login with any demo credentials
2. Navigate to `/payment` to see the activation page with policies
3. Click "Activate Protection" button
4. View the dashboard with all features

Enjoy!
