<#
  SST Platform - Docker Compose installer (Windows, Docker Desktop)

  Builds and starts the whole stack with Docker Compose, waits until it is ready and prints
  the one-time setup code. Re-running it upgrades the installation; data volumes are kept.

    powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1
    powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1 -Port 80
    powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1 -Domain www.school.pk -Email it@school.pk

  -Domain / -Email  serve the site over HTTPS (ports 80/443) with an automatic Let's Encrypt
                    certificate; several names: -Domain "school.pk,www.school.pk"
  -Staging          use Let's Encrypt's test service (untrusted certificate, for trial runs)
  -NoHttps          turn HTTPS off again
#>
param(
  [ValidateRange(1, 65535)][int]$Port = 0,
  [string]$Domain = '',
  [string]$Email = '',
  [switch]$Staging,
  [switch]$NoHttps
)
$HttpsFiles = 'docker-compose.yml:docker-compose.https.yml'
$LeStaging = 'https://acme-staging-v02.api.letsencrypt.org/directory'
# Native commands are checked through $LASTEXITCODE (Windows PowerShell 5.1 turns redirected
# native stderr into errors under 'Stop').
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Info($t) { Write-Host "    $t" }
function Fail($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }

if (-not (Test-Path docker-compose.yml) -or -not (Select-String -Path package.json -Pattern '"name": "sst-platform"' -Quiet)) {
  Fail 'Run the script from inside the SST project folder (install\install-docker.ps1).'
}
if ($Domain -and -not $Email) { Fail '-Domain needs -Email (Let''s Encrypt sends certificate notices there).' }
if ($Email -and -not $Domain) { Fail '-Email needs -Domain.' }
if ($Domain -and $NoHttps) { Fail '-Domain and -NoHttps cannot be combined.' }
if ($Domain) {
  $Domain = (($Domain -replace '\s', '') -split ',' | Where-Object { $_ }) -join ', '
  if ($Domain -notmatch '^[A-Za-z0-9.,\- ]+$') { Fail '-Domain may only contain domain names separated by commas.' }
  if ($Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Fail '-Email is not a valid e-mail address.' }
}
Write-Host 'SST Platform - Docker Compose installer' -ForegroundColor White

# 1. Docker
Step 'Checking Docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail 'Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop/'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker is installed but not running. Start Docker Desktop and try again.' }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'The Docker Compose plugin is missing. Update Docker Desktop.' }
Info (docker --version)
Info (docker compose version)

# 2. optional .env (infrastructure only)
Step 'Preparing configuration'
$envFile = Join-Path $Root '.env'
function Get-EnvValue($key) {
  if (-not (Test-Path $envFile)) { return '' }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -Last 1
  if ($line) { return ($line -replace "^$key=", '').Trim().Trim('"', "'") } else { return '' }
}
function Set-EnvValue($key, $value) {
  $lines = @()
  if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch "^$key=" }) }
  $lines += "$key=$value"
  # ASCII without BOM so Docker Compose reads the first line correctly
  [IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.ASCIIEncoding))
}

function Remove-EnvValue($key) {
  if (-not (Test-Path $envFile)) { return }
  $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch "^$key=" })
  [IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.ASCIIEncoding))
}

if ($Port -gt 0) { Set-EnvValue 'HTTP_PORT' $Port }
$HttpPort = Get-EnvValue 'HTTP_PORT'
if (-not $HttpPort) { $HttpPort = '8000' }

if ($Domain) {
  # Saved in .env so that every later "docker compose ..." command keeps HTTPS enabled.
  Set-EnvValue 'COMPOSE_FILE' $HttpsFiles
  Set-EnvValue 'COMPOSE_PATH_SEPARATOR' ':'
  Set-EnvValue 'DOMAIN' ('"' + $Domain + '"')
  Set-EnvValue 'ACME_EMAIL' $Email
  if ($Staging) { Set-EnvValue 'ACME_CA' $LeStaging } else { Remove-EnvValue 'ACME_CA' }
} elseif ($NoHttps) {
  foreach ($k in 'COMPOSE_FILE', 'COMPOSE_PATH_SEPARATOR', 'DOMAIN', 'ACME_EMAIL', 'ACME_CA') { Remove-EnvValue $k }
  Info 'HTTPS turned off'
}
$Https = (Get-EnvValue 'COMPOSE_FILE') -eq $HttpsFiles
$Domain = Get-EnvValue 'DOMAIN'
$FirstDomain = ($Domain -split ',')[0].Trim()
if ($Https) {
  $note = if ((Get-EnvValue 'ACME_CA') -eq $LeStaging) { ' (staging)' } else { '' }
  Info "HTTPS with Let's Encrypt for: $Domain$note"
}

docker volume inspect sst_pgdata *> $null
if ($LASTEXITCODE -eq 0) {
  Info 'Existing database found - keeping its password and data'
  if (-not (Get-EnvValue 'POSTGRES_PASSWORD')) {
    Info '(no POSTGRES_PASSWORD in .env: the database must have been created with the built-in default)'
  }
} elseif (-not (Get-EnvValue 'POSTGRES_PASSWORD')) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  Set-EnvValue 'POSTGRES_PASSWORD' (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
  Info 'Generated a database password (saved in .env - keep this file)'
}

$checkPorts = if ($Https) { @(80, 443) } else { @([int]$HttpPort) }
foreach ($p in $checkPorts) {
  $busy = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  if ($busy) {
    $owners = ($busy | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } | Sort-Object -Unique) -join ', '
    if ($owners -notmatch 'docker|com\.docker|wslrelay|vpnkit') {
      Write-Host "WARNING: port $p is already in use by: $owners" -ForegroundColor Yellow
    }
  }
}

# 3. build and start
Step 'Building and starting the containers (the first build takes several minutes)'
docker compose up -d --build --remove-orphans
if ($LASTEXITCODE -ne 0) { Fail 'docker compose up failed - see the output above.' }

Step 'Waiting for the API (the first start loads the sample content)'
$apiId = (docker compose ps -q api | Out-String).Trim()
$status = ''
for ($i = 0; $i -lt 120; $i++) {
  $status = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $apiId 2>$null | Out-String).Trim()
  if ($status -eq 'healthy' -or $status -eq 'exited' -or $status -eq 'dead') { break }
  Start-Sleep -Seconds 5
}
if ($status -ne 'healthy') {
  docker compose logs --tail=60 api
  Fail "The API did not become healthy (status: $status). See the log above or: docker compose logs api"
}
Info 'API is healthy'

if ($Https) {
  $base = "https://$FirstDomain"
  Step "Waiting for the Let's Encrypt certificate"
  $ok = $false
  for ($i = 0; $i -lt 36; $i++) {
    try { Invoke-WebRequest -Uri "$base/robots.txt" -UseBasicParsing -TimeoutSec 10 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 5 }
  }
  if ($ok) { Info 'Certificate installed - renewed automatically before it expires' }
  elseif ((Get-EnvValue 'ACME_CA') -eq $LeStaging) { Info 'Staging certificate requested (browsers do not trust it). Re-run without -Staging when ready.' }
  else {
    docker compose logs --tail=40 https
    Write-Host "WARNING: the certificate is not ready yet. Check that $FirstDomain points to this machine and ports 80/443 are reachable from the internet; it keeps retrying (docker compose logs -f https)." -ForegroundColor Yellow
  }
} else {
  $base = if ($HttpPort -eq '80') { 'http://localhost' } else { "http://localhost:$HttpPort" }
}

# done
Write-Host ''
Write-Host 'SST Platform is running.' -ForegroundColor Green
Write-Host "    Website:               $base/"
Write-Host "    Administration portal: $base/admin/"
$code = (docker compose exec -T api cat config/setup-code.txt 2>$null | Out-String).Trim()
if ($code) {
  Write-Host ''
  Write-Host '    First-run setup: open the administration portal and enter this setup code:'
  Write-Host ''
  Write-Host "        $code" -ForegroundColor White
  Write-Host ''
  Write-Host '    (shown again any time with:  docker compose logs api)'
}
Write-Host ''
Write-Host '    Status:     docker compose ps'
Write-Host '    Logs:       docker compose logs -f api web'
Write-Host '    Stop:       docker compose down          (data is kept in Docker volumes)'
Write-Host '    Upgrade:    pull the new version, then run this script again'
if ($Https) {
  Write-Host '    HTTPS:      certificates renew automatically (docker compose logs https)'
  Write-Host "                In Administration > System, the public address should be $base"
} else {
  Write-Host '    HTTPS:      re-run with  -Domain <your-domain> -Email <address>'
}
