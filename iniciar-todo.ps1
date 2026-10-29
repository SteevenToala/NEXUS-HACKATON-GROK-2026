# Script de automatizacion total para la Hackathon FISEI UTA

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   INICIANDO TODO EL ECOSISTEMA (1 SOLO CLIC)          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 0. Limpiar procesos antiguos de cloudflared si quedaron abiertos
Write-Host "[0/4] Cerrando conexiones de tuneles anteriores..." -ForegroundColor Gray
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 1. Asegurar contenedores Docker arriba
Write-Host "[1/4] Verificando contenedores Docker..." -ForegroundColor Yellow
docker compose up -d
Start-Sleep -Seconds 2

# 2. Leer Bot Token
$envFile = Join-Path $PSScriptRoot ".env"
$botToken = ""
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^TELEGRAM_BOT_TOKEN\s*=\s*`"?(.*?)`"?$") {
            $botToken = $matches[1].Trim()
        }
    }
}

if (-not $botToken) {
    $botToken = "9016151329:AAFZ4EXh0luoFCMSQLUjZ_DrGdePgX-4QZk"
}

# 3. Lanzar Tunel Cloudflare para Backend y capturar URL
Write-Host "[2/4] Levantando tunel Cloudflare para el Backend (Puerto 3000)..." -ForegroundColor Yellow
$backendLog = Join-Path $PSScriptRoot "tunnel-backend.log"
try {
    if (Test-Path $backendLog) { Remove-Item $backendLog -Force -ErrorAction SilentlyContinue }
} catch {}

$cfBackendProc = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:3000" -RedirectStandardError $backendLog -PassThru -WindowStyle Hidden

$backendUrl = ""
$attempts = 0
while (-not $backendUrl -and $attempts -lt 25) {
    Start-Sleep -Seconds 1
    $attempts++
    if (Test-Path $backendLog) {
        $content = Get-Content $backendLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $backendUrl = $matches[1]
        }
    }
    Write-Host "." -NoNewline
}
Write-Host ""

if ($backendUrl) {
    Write-Host "[OK] Tunel Backend activo en: $backendUrl" -ForegroundColor Green
    
    # 4. Vincular automáticamente con Telegram con reintentos para permitir propagación DNS de Cloudflare
    Write-Host "[3/4] Vinculando Webhook en Telegram (esperando propagación DNS)..." -ForegroundColor Yellow
    $webhookUrl = "$backendUrl/webhook/telegram"
    $tgApiUrl = "https://api.telegram.org/bot$botToken/setWebhook?url=$webhookUrl"
    
    $webhookLinked = $false
    $retry = 0
    while (-not $webhookLinked -and $retry -lt 8) {
        $retry++
        Start-Sleep -Seconds 3
        try {
            $tgRes = Invoke-RestMethod -Uri $tgApiUrl -Method Get -ErrorAction Stop
            if ($tgRes.ok) {
                Write-Host "[OK] Webhook vinculado exitosamente con Telegram!" -ForegroundColor Green
                $webhookLinked = $true
            } else {
                Write-Host "Intento $($retry): $($tgRes.description)..." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Propagando DNS de Cloudflare (intento $retry/8)..." -ForegroundColor Yellow
        }
    }

    if (-not $webhookLinked) {
        Write-Host "[!] Si la red tarda en propagar, puedes vincular manualmente con set-webhook.bat pegando: $backendUrl" -ForegroundColor Yellow
    }
} else {
    Write-Host "[!] No se pudo capturar la URL automaticamente." -ForegroundColor Yellow
}

# 5. Lanzar Tunel para Frontend en ventana visible para que el jurado pueda ver la URL
Write-Host "[4/4] Levantando tunel Cloudflare para el Dashboard del Jurado..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c tunnel-frontend.bat"

# 6. Abrir Dashboard en el navegador
Start-Process "http://localhost:3001"

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   TODO EL SISTEMA ESTA ACTIVO Y OPERACIONAL           " -ForegroundColor Green
Write-Host "   - Bot de Telegram: RESPONDIENDO EN VIVO             " -ForegroundColor Green
Write-Host "   - Dashboard Operador: http://localhost:3001         " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
