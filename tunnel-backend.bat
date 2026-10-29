@echo off
echo ========================================================
echo   PUBLICANDO BACKEND NESTJS (PUERTO 3000) CON CLOUDFLARE
echo ========================================================
echo Copia la URL HTTPS que termine en '.trycloudflare.com'
echo para registrar tu Webhook de Telegram.
echo.
cloudflared tunnel --url http://localhost:3000
pause
