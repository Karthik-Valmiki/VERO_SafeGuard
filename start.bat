@echo off
echo ========================================
echo   VERO - Starting Docker Containers
echo ========================================
echo.

echo Checking if Docker is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Docker is running!
echo.
echo Building and starting all services...
echo This may take a few minutes on first run...
echo.

docker compose up --build

echo.
echo ========================================
echo   Services stopped
echo ========================================
pause
