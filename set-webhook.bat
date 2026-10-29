@echo off
echo ========================================================
echo   CONFIGURADOR DE WEBHOOK DE TELEGRAM
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-telegram-webhook.ps1"
pause
