@echo off
echo ========================================================
echo   INICIANDO HACKATHON STACK CON DOCKER COMPOSE
echo ========================================================
echo 1. PostgreSQL (Base de datos)
echo 2. Backend NestJS (Conecta al Ollama de tu PC o Gemini)
echo 3. Dashboard Next.js (Puerto 3001)
echo.
docker compose up --build -d
echo.
echo ========================================================
echo   SERVICIOS ACTIVOS
echo ========================================================
echo - Backend NestJS:    http://localhost:3000
echo - Webhook Telegram:  http://localhost:3000/webhook/telegram
echo - Dashboard Next.js: http://localhost:3001
echo - PostgreSQL:        localhost:5432
echo.
echo Recuerda tener abierto en tu PC: ollama run qwen2.5:3b
echo o tu GEMINI_API_KEY en .env
echo ========================================================
pause
