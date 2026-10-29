@echo off
echo ========================================================
echo   LEVANTANDO SOLO POSTGRESQL EN DOCKER (2 SEGUNDOS)
echo ========================================================
docker compose up -d postgres
echo.
echo PostgreSQL listo en localhost:5432
echo.
echo Ahora en tus terminales corre:
echo - Terminal 1: cd backend && npm run start:dev
echo - Terminal 2: cd frontend && npm run dev
echo ========================================================
pause
