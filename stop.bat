@echo off
echo ========================================
echo   VERO - Stopping Docker Containers
echo ========================================
echo.

docker compose down

echo.
echo All services stopped!
echo.
pause
