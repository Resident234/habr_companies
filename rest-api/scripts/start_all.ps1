# start_all.ps1 - One-command startup: rest-api + ngrok tunnel.
# Run from the rest-api directory:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1
param(
    [string]$EnvFile
)
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "rest-api + ngrok"

# Prevent concurrent startup scripts from racing and creating duplicate ngrok endpoints.
$startMutex = [System.Threading.Mutex]::new($false, 'Local\HabrCompanies.RestApiNgrok.StartAll')
try { $startMutexAcquired = $startMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $startMutexAcquired = $true }
if (-not $startMutexAcquired) {
    Write-Error 'Another start_all.ps1 instance is already running; refusing to start a second REST API/ngrok pair.'
    $startMutex.Dispose()
    exit 1
}

# - 1. Resolve paths -
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
if (-not $EnvFile) {
    $defaultEnv = Join-Path $ProjectDir ".env"
    if (Test-Path $defaultEnv) {
        $EnvFile = $defaultEnv
    } else {
        $EnvFile = Join-Path (Get-Location) ".env"
    }
}
if (-not (Test-Path $EnvFile)) {
    Write-Error ".env file not found at: $EnvFile"
    exit 1
}
Write-Output "Loading config from: $EnvFile"

# - 2. Parse .env -
$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $idx = $line.IndexOf("=")
        if ($idx -gt 0) {
            $key = $line.Substring(0, $idx).Trim()
            $val = $line.Substring($idx + 1).Trim()
            if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            if (-not $envVars.ContainsKey($key)) {
                $envVars[$key] = $val
            }
        }
    }
}
foreach ($k in $envVars.Keys) {
    if ($envVars[$k] -and -not [Environment]::GetEnvironmentVariable($k, "Process")) {
        [Environment]::SetEnvironmentVariable($k, $envVars[$k], "Process")
    }
}

# Validate required
$required = @("DB_HOST", "DB_USER", "DB_NAME", "COMPANY_API_KEY", "NGROK_AUTHTOKEN")
$missing = @()
foreach ($r in $required) {
    if (-not [Environment]::GetEnvironmentVariable($r, "Process")) { $missing += $r }
}
if ($missing.Count -gt 0) {
    Write-Error "Missing required config in .env: $($missing -join ', ')"
    exit 1
}

$ApiKey      = [Environment]::GetEnvironmentVariable("COMPANY_API_KEY", "Process")
$AuthToken   = [Environment]::GetEnvironmentVariable("NGROK_AUTHTOKEN", "Process")
$NgrokExeCfg = [Environment]::GetEnvironmentVariable("NGROK_EXE", "Process")
$HttpAddr    = [Environment]::GetEnvironmentVariable("HTTP_ADDR", "Process")
if (-not $HttpAddr) { $HttpAddr = ":8080" }
$LocalPort = $HttpAddr -replace "^:", ""

# - 3. Locate or download ngrok -
function Find-NgrokExe {
    if ($NgrokExeCfg -and (Test-Path $NgrokExeCfg)) { return $NgrokExeCfg }
    $fromPath = (Get-Command "ngrok.exe" -ErrorAction SilentlyContinue).Source
    if ($fromPath) { return $fromPath }
    foreach ($p in @("$env:USERPROFILE\scoop\shims\ngrok.exe", "$env:LOCALAPPDATA\ngrok\ngrok.exe", "C:\ngrok\ngrok.exe", "$env:TEMP\ngrok\ngrok.exe")) {
        if (Test-Path $p) { return $p }
    }
    $wingetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $wingetRoot) {
        $fromWinget = Get-ChildItem -Path $wingetRoot -Recurse -File -Filter "ngrok.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($fromWinget) { return $fromWinget.FullName }
    }
    return $null
}
function Download-Ngrok {
    $zip  = "$env:TEMP\ngrok_setup.zip"
    $dest = "$env:TEMP\ngrok"
    Write-Host "Downloading ngrok..."
    Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $dest -Force
    Remove-Item $zip -Force
    $exe = Join-Path $dest "ngrok.exe"
    if (-not (Test-Path $exe)) { Write-Error "ngrok.exe not found after extraction"; exit 1 }
    Write-Host "ngrok extracted to: $exe"
    Write-Output $exe
}
function Get-NgrokVersion {
    param([string]$Executable, [string]$ConfigPath)
    $versionOutput = (& $Executable version --config $ConfigPath 2>$null | Out-String).Trim()
    $match = [regex]::Match($versionOutput, 'ngrok version (?<version>\d+\.\d+\.\d+)')
    if (-not $match.Success) { return $null }
    try { return [version]$match.Groups['version'].Value } catch { return $null }
}

$NgrokExe = Find-NgrokExe
if (-not $NgrokExe) { $NgrokExe = Download-Ngrok }
Write-Output "Using ngrok: $NgrokExe"

# - 4. Configure ngrok authtoken -
# Use a dedicated config because older ngrok installations may leave an incompatible
# versioned config in %LOCALAPPDATA%\ngrok or %USERPROFILE%\.ngrok2.
$NgrokConfig = Join-Path $env:TEMP "habr_companies_ngrok.yml"
Write-Output "Configuring ngrok authtoken in: $NgrokConfig"
& $NgrokExe config add-authtoken $AuthToken --config $NgrokConfig 2>$null
if ($LASTEXITCODE -ne 0) { Write-Error "ngrok authtoken configuration failed"; exit 1 }

$minimumNgrokVersion = [version]'3.20.0'
$ngrokVersion = Get-NgrokVersion -Executable $NgrokExe -ConfigPath $NgrokConfig
if ($null -eq $ngrokVersion) {
    Write-Error "ngrok executable could not be started or its version could not be determined"
    exit 1
}
if ($ngrokVersion -lt $minimumNgrokVersion) {
    Write-Output "ngrok Agent $ngrokVersion is older than required $minimumNgrokVersion; attempting self-update."
    & $NgrokExe update --config $NgrokConfig 2>$null
    $ngrokVersion = Get-NgrokVersion -Executable $NgrokExe -ConfigPath $NgrokConfig
}
if ($null -eq $ngrokVersion -or $ngrokVersion -lt $minimumNgrokVersion) {
    $actualVersion = if ($ngrokVersion) { $ngrokVersion } else { 'unknown' }
    Write-Error "ngrok Agent $actualVersion is unsupported; version $minimumNgrokVersion or newer is required. Set NGROK_EXE to a current trusted ngrok.exe."
    exit 1
}
Write-Output "Using ngrok Agent $ngrokVersion"

# - 5. Stop previous instances -
Write-Output "Stopping previous instances..."
Get-Process -Name "rest-api" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# - 6. Locate or build rest-api.exe -
$RestApiExe = Join-Path $ProjectDir "rest-api.exe"
$needsBuild = -not (Test-Path $RestApiExe)
if (-not $needsBuild) {
    $exeTime = (Get-Item $RestApiExe).LastWriteTimeUtc
    $sourceFiles = Get-ChildItem -Path $ProjectDir -Recurse -File -Include *.go,go.mod,go.sum |
        Where-Object { $_.FullName -notmatch '[\\/](vendor|\.git)[\\/]' }
    if ($sourceFiles | Where-Object { $_.LastWriteTimeUtc -gt $exeTime }) {
        $needsBuild = $true
        Write-Output "Go sources or module files are newer than rest-api.exe; rebuilding."
    }
}
if ($needsBuild) {
    Write-Output "Building rest-api.exe..."
    $goCmd = (Get-Command "go.exe" -ErrorAction SilentlyContinue).Source
    if (-not $goCmd) { Write-Error "Go not found. Install Go or place rest-api.exe in $ProjectDir"; exit 1 }
    $prev = Get-Location
    Set-Location $ProjectDir
    & $goCmd build -o "$RestApiExe" ./operate
    $buildExitCode = $LASTEXITCODE
    Set-Location $prev
    if ($buildExitCode -ne 0) { Write-Error "go build failed"; exit 1 }
    if (-not (Test-Path $RestApiExe)) { Write-Error "rest-api.exe was not created"; exit 1 }
    Write-Output "Built: $RestApiExe"
} else {
    Write-Output "Found up-to-date: $RestApiExe"
}

# - 7. Start rest-api -
Write-Output "Starting rest-api on :$LocalPort..."
$apiProcess = Start-Process -FilePath $RestApiExe -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
$ApiPid = $apiProcess.Id
Write-Output "rest-api PID: $ApiPid"

# Wait for server to become ready (TCP check - avoids HTTP 404 errors)
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    $tcp = Test-NetConnection -ComputerName "localhost" -Port $LocalPort -WarningAction SilentlyContinue -InformationLevel Quiet -ErrorAction SilentlyContinue
    if ($tcp) {
        $ready = $true
        break
    }
}
if (-not $ready) { Write-Error "rest-api did not become ready"; exit 1 }
Write-Output "rest-api is responding on :$LocalPort"

# - 8. Start ngrok -
Write-Output "Starting ngrok tunnel on port $LocalPort..."
$ngrokLog = "$env:TEMP\ngrok_startall.log"
$ngrokErrLog = "$env:TEMP\ngrok_startall.err.log"

Write-Output "Trimming previous ngrok log files..."
. (Join-Path $ScriptDir 'trim_log.ps1')
Trim-LogBytes $ngrokLog (512 * 1024)
Trim-LogBytes $ngrokErrLog (128 * 1024)

$ngrokProcess = Start-Process -FilePath $NgrokExe `
    -ArgumentList @("--config", $NgrokConfig, "http", $LocalPort, "--log=stdout", "--log-format=json", "--log-level=info") `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ngrokLog `
    -RedirectStandardError $ngrokErrLog `
    -PassThru
Write-Output "ngrok PID: $($ngrokProcess.Id)"

# - 9. Get public URL -
Write-Output "Waiting for ngrok tunnel..."
$publicUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($tunnels -and $tunnels.tunnels -and $tunnels.tunnels.Count -gt 0) {
        $publicUrl = $tunnels.tunnels[0].public_url
        break
    }
}
if (-not $publicUrl) { Write-Error "Could not retrieve ngrok public URL. Check log: $ngrokLog"; exit 1 }

# - 10. Test external access -
Write-Output "Testing external access via ngrok..."
$testResult = Invoke-WebRequest `
    -Uri "$publicUrl/company/add/_startup_test/StartupTest" `
    -Method POST `
    -Headers @{"X-API-Key" = $ApiKey} `
    -UseBasicParsing `
    -TimeoutSec 10 `
    -ErrorAction SilentlyContinue
if ($testResult) {
    Write-Output "Test request: $($testResult.StatusCode) -> $($testResult.Content)"
} else {
    Write-Output "Test request warning - tunnel may still work. Check manually."
}

# - 11. Summary -
Write-Output ""
Write-Output "============================================"
Write-Output "  SERVICE IS LIVE"
Write-Output "============================================"
Write-Output "  Local:     http://localhost:$LocalPort"
Write-Output "  Public:    $publicUrl"
Write-Output "  API Key:   loaded from .env (not printed)"
Write-Output "  ngrok UI:  http://localhost:4040"
Write-Output "============================================"
Write-Output ""
Write-Output "Example (replace the placeholder with your key):"
Write-Output "  curl -X POST ""$publicUrl/company/add/test/%D1%82%D0%B5%D1%81%D1%82"" -H ""X-API-Key: <COMPANY_API_KEY>"""
Write-Output ""
Write-Output "Press Ctrl+C to stop both services, or close this window."

# - 12. Keep alive -
while ($true) {
    Start-Sleep -Seconds 2
    if ($apiProcess.HasExited) {
        Write-Output "rest-api process exited unexpectedly!"
        Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
        exit 1
    }
    if ($ngrokProcess.HasExited) {
        Write-Output "ngrok process exited unexpectedly!"
        Stop-Process -Id $ApiPid -Force -ErrorAction SilentlyContinue
        exit 1
    }
}
