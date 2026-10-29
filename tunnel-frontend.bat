@echo off
echo ========================================================
echo   PUBLICANDO DASHBOARD NEXT.JS (PUERTO 3001) CON CLOUDFLARE
echo ========================================================
echo Esta URL publica es la que entregaras al jurado (Entregable 2):
echo.
cloudflared tunnel --url http://localhost:3001
pause
