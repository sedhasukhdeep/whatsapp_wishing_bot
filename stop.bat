@echo off
cd /d "%~dp0"

echo Stopping Wishing Bot...
docker compose stop 2>nul || docker-compose stop

echo All services stopped.
pause
