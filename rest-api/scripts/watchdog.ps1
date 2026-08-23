# watchdog.ps1 - monitors rest-api.exe + ngrok, logs crashes to watchdog.log
$ErrorActionPreference = "SilentlyContinue"
$LogFile = Join-Path $PSScriptRoot "watchdog.log"
$CheckInterval = 5

# Ensure only one watchdog supervises the REST API/ngrok pair.
$watchdogMutex = [System.Threading.Mutex]::new($false, 'Local\HabrCompanies.RestApiNgrok.Watchdog')
try { $watchdogMutexAcquired = $watchdogMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $watchdogMutexAcquired = $true }
if (-not $watchdogMutexAcquired) {
    Write-Output 'Another watchdog.ps1 instance is already running; exiting.'
    $watchdogMutex.Dispose()
    exit 0
}
. (Join-Path $PSScriptRoot 'trim_log.ps1')
Trim-LogLines $LogFile 1000

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Write-Output $line
    Add-Content -Path $LogFile -Value $line
    Trim-LogLines $LogFile 1000
    }

Log "Watchdog started."
$apiPid = $null
$ngrokPid = $null
$restartJob = $null
$lastRestartAt = [DateTime]::MinValue
$restartCooldown = [TimeSpan]::FromSeconds(30)
$api0 = Get-Process -Name "rest-api" -ErrorAction SilentlyContinue
$ng0 = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
Log ("Initial state: rest-api=" + $(if ($api0) { 'PID ' + $api0.Id } else { 'down' }) + ", ngrok=" + $(if ($ng0) { 'PID ' + $ng0.Id } else { 'down' }))

while ($true) {
    $api = Get-Process -Name "rest-api" -ErrorAction SilentlyContinue
    $ng = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
    $apiIsHealthy = $null -ne $api
    $ngrokIsHealthy = $null -ne $ng

    if ($restartJob -and $restartJob.State -notin @('NotStarted', 'Running')) {
        Log "Restart job finished with state $($restartJob.State)"
        Remove-Job -Job $restartJob -Force -ErrorAction SilentlyContinue
        $restartJob = $null
    }

    if ($apiIsHealthy -and $api.Id -ne $apiPid) {
        Log "rest-api found, PID $($api.Id)"
        $apiPid = $api.Id
    }
    if ($ngrokIsHealthy -and $ng.Id -ne $ngrokPid) {
        Log "ngrok found, PID $($ng.Id)"
        $ngrokPid = $ng.Id
    }

    if (-not $apiIsHealthy -or -not $ngrokIsHealthy) {
        $missing = @()
        if (-not $apiIsHealthy) { $missing += 'rest-api' }
        if (-not $ngrokIsHealthy) { $missing += 'ngrok' }
        Log "CRASH: missing process(es): $($missing -join ', ')"

        $now = Get-Date
        $cooldownActive = ($now - $lastRestartAt) -lt $restartCooldown
        if ($restartJob) {
            Log "Autorestart already in progress; waiting for its result"
        } elseif ($cooldownActive) {
            Log "Autorestart suppressed for $([int]($restartCooldown - ($now - $lastRestartAt)).TotalSeconds)s cooldown"
        } else {
            if ($ngrokIsHealthy) {
                Stop-Process -Id $ng.Id -Force -ErrorAction SilentlyContinue
            }
            $apiPid = $null
            $ngrokPid = $null
            Log "Autorestart: launching start_all.ps1"
            $startScript = Join-Path $PSScriptRoot "start_all.ps1"
            $restartJob = Start-Job -ScriptBlock {
                param($scriptPath)
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath 2>&1 | Out-Null
            } -ArgumentList $startScript
            $lastRestartAt = $now
        }
    }

    Start-Sleep -Seconds $CheckInterval
}
