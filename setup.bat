@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File setup-wizard.ps1
pause
