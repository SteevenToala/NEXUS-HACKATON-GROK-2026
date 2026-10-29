# Script para vincular el Webhook de Telegram con la URL publica de Cloudflare

$rootEnv = Join-Path $PSScriptRoot ".env"
$backendEnv = Join-Path $PSScriptRoot "backend\.env"
$botToken = ""

# 1. Intentar leer del .env raiz
if (Test-Path $rootEnv) {
    Get-Content $rootEnv | ForEach-Object {
        if ($_ -match "^TELEGRAM_BOT_TOKEN\s*=\s*`"?(.*?)`"?$") {
            $val = $matches[1].Trim()
            if ($val -and $val -ne "AQUI_TU_TELEGRAM_BOT_TOKEN") { $botToken = $val }
        }
    }
}

# 2. Si no, intentar leer del backend/.env
if (-not $botToken -and (Test-Path $backendEnv)) {
    Get-Content $backendEnv | ForEach-Object {
        if ($_ -match "^TELEGRAM_BOT_TOKEN\s*=\s*`"?(.*?)`"?$") {
            $val = $matches[1].Trim()
            if ($val -and $val -ne "AQUI_TU_TELEGRAM_BOT_TOKEN") { $botToken = $val }
        }
    }
}

# 3. Si no esta definido, solicitarlo por consola
if (-not $botToken) {
    $botToken = Read-Host "Ingresa tu Telegram Bot Token de @BotFather"
}

Write-Host "Bot Token detectado: $($botToken.Substring(0, [Math]::Min(12, $botToken.Length)))..." -ForegroundColor Cyan
$cloudflareUrl = Read-Host "Pega la URL de Cloudflare del Backend (ej: https://xyz.trycloudflare.com)"

$cleanUrl = $cloudflareUrl.Trim().TrimEnd('/')
$webhookUrl = "$cleanUrl/webhook/telegram"

Write-Host "Configurando Webhook en: $webhookUrl" -ForegroundColor Yellow

$telegramApiUrl = "https://api.telegram.org/bot$botToken/setWebhook?url=$webhookUrl"

try {
    $response = Invoke-RestMethod -Uri $telegramApiUrl -Method Get
    Write-Host "Resultado de Telegram:" -ForegroundColor Green
    $response | Format-List
} catch {
    Write-Host "Error configurando Webhook: $_" -ForegroundColor Red
}

Write-Host "Listo. Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
