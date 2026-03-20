@echo off
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running. Please start Docker Desktop and try again.
  pause
  exit /b 1
)

echo Starting Wishing Bot...
docker compose up -d 2>nul || docker-compose up -d

echo Waiting for app to be ready...
set /a count=0
:wait_loop
set /a count+=1
if %count% geq 30 goto open_browser
curl -s http://localhost/health >nul 2>&1
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto wait_loop
)

:open_browser
echo Opening http://localhost ...
start http://localhost
pause
