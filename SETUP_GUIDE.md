# VERO SafeGuard — Deployment & Setup Guide

> [!NOTE]
> **Recommended Reading Order**: If you are new to the platform, we recommend reading the [**Product Whitepaper (README.md)**](README.md) first to understand the product vision and mechanics before proceeding with the technical setup.

This document provides a comprehensive guide to set up and run the VERO SafeGuard platform locally. VERO is an AI-powered parametric income protection platform designed for India's food delivery gig economy.

**Estimated Demo Time: ~5 minutes**

---

## System Architecture

VERO is built using a modern, containerized microservices architecture:
- **Rider PWA (Frontend)**: React.js application optimized for mobile-first delivery partners.
- **Admin Dashboard**: React.js based management console for monitoring live disruptions and claims.
- **Backend API**: FastAPI (Python) service handling business logic, parametric triggers, and ML engines.
- **Database**: PostgreSQL for persistent storage of policies, claims, and rider data.
- **ML Engine**: Scikit-learn integration for Reliability Scoring and Fraud Anomaly Detection.

---

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
- **Docker Compose**: Usually bundled with Docker Desktop.
- **Git**: For cloning the repository.

### System Requirements
- **Memory**: Minimum 8GB RAM.
- **Storage**: 10GB free disk space.
- **Software**: Docker Desktop 4.x or higher.
- **Hardware Architecture**: Supports both x86 and Apple Silicon (M1/M2/M3) natively.

---

## Launching the Platform

The entire platform can be launched with a single command if you have Docker installed.

### Option A: Windows 
Double-click the `start.bat` file in the root directory. This script verifies Docker is running and executes the build command automatically.

### Option B: Command Line (Preferable)
1. **Clone the Repository**:
   ```bash
   git clone <repo-url>
   cd VERO_SafeGuard
   ```

2. **Initialize Environment Variables**:
   Copy the example environment file to create your active `.env` file:
   ```bash
   cp .env.example .env
   ```
   *The default values in .env are pre-configured to work perfectly for local Docker runs.*

3. **Launch**:
   ```bash
   docker compose up --build
   ```
   *Note: The first build may take 2–4 minutes to download and compile dependencies. Subsequent starts will be nearly instantaneous.*

### Expected Output
Once the system is healthy, you should see logs similar to:
```text
vero-db      | database system is ready to accept connections
vero-backend | Application startup complete.
vero-frontend| Listening on port 80
```

---

## Navigating the Services

Once the containers are running, the following services are available:

| Service | Port / URL | Description |
| :--- | :--- | :--- |
| **Rider PWA** | [http://localhost](http://localhost) | Mobile-first interface for delivery partners to buy policies and view claims. |
| **Admin Dashboard** | [http://localhost:8080](http://localhost:8080) | Live monitoring panel for platform admins to track disruptions and fraud. |
| **Backend API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger UI for exploring and testing API endpoints. |
| **PostgreSQL** | `localhost:5432` | Internal database (not exposed by default except to services). |

---

## Demo Credentials

To experience the full functionality of the platform, use the following credentials:

### Rider PWA
- **Login**: Use any valid 10-digit phone number (e.g., `9876543210`). OTP verification is simulated in the demo. Enter OTP when prompted to continue

### Admin Dashboard
- **Username**: `admin@vero`
- **Password**: `admin1234`
- **Admin API Key**: `vero_admin_key_2026` (Pre-configured in `.env`)

---

## Quick Demo Walkthrough

Follow this happy path to explore VERO in under 5 minutes:

1. **Rider Access**: Open the Rider PWA and log in. Navigate to "Buy Policy" and complete the purchase via the simulated Razorpay flow.
2. **Policy Verification**: Verify your policy status is "Active" on the Rider Dashboard.
3. **Admin Control**: Open the Admin Dashboard in a separate tab and log in. Navigate to the "Simulation Control" panel.
4. **Trigger Disruption**: Select a zone where your rider is registered and trigger a "Rain/Weather" disruption.
5. **Real-time Claim**: Return to the Rider PWA. Observe the "Disruption Alert" banner and watch the claim process in real-time.
6. **Payout Confirmation**: Check the "Claims History" in both the Rider and Admin dashboards to confirm the parametric payout was successfully logged.

---

## Environment Configuration

The `.env` file controls core system behavior:
- `POSTGRES_USER`/`PASS`: Database authentication.
- `ADMIN_API_KEY`: Secures sensitive administrative endpoints.
- `RAZORPAY_KEY` (Optional): Pre-filled with sandbox keys to demonstrate the payout workflow.
- `VITE_API_URL`: Points the frontend to the backend proxy.

---

## Troubleshooting

### WSL2 Backend (Windows)
If you are on Windows and containers fail to start or the database connection times out, ensure the **WSL2 based engine** is enabled in Docker Desktop settings (Settings > General > Use the WSL 2 based engine).

### Port Conflicts
If you receive an error stating `Port 80 is already in use`:
1. Open `docker-compose.yml`.
2. Change the `frontend` ports from `"80:80"` to `"3000:80"`.
3. Access the Rider PWA at `http://localhost:3000`.

### Database Reset
If you need to wipe all data and start with a fresh environment:
```bash
docker compose down -v
docker compose up --build
```

---

## Repository Structure
```text
VERO_SafeGuard/
├── admin-dashboard/       # Admin Management Front-end (React)
├── frontend/              # Rider PWA Front-end (React)
├── backend/               # FastAPI Backend & ML Service
├── docker-compose.yml     # Orchestration for all services
├── README.md              # Product Whitepaper & Feature Details
└── SETUP_GUIDE.md         # This guide
```

---

> **A Note for Judges**: VERO utilizes a **Simulation Engine** for triggers like Platform Blackouts and Social Disruption to ensure you can see the platform's response during the demo, as these events do not occur every minute in the real world. You can trigger these manually via the Admin Dashboard's "Simulation Control" tab.
