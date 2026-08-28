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

function Test-NgrokTunnel {
    try {
        $tunnelResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -TimeoutSec 3
        return @($tunnelResponse.tunnels).Count -gt 0
    } catch {
        return $false
    }
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
    $ngrokProcessHealthy = $null -ne $ng
    $ngrokTunnelHealthy = $ngrokProcessHealthy -and (Test-NgrokTunnel)
    $ngrokIsHealthy = $ngrokProcessHealthy -and $ngrokTunnelHealthy

    if ($restartJob -and $restartJob.State -notin @('NotStarted', 'Running')) {
        $restartState = $restartJob.State
        $restartOutput = @(Receive-Job -Job $restartJob -Keep -ErrorAction SilentlyContinue)
        Log "Restart job finished with state $restartState"
        foreach ($line in $restartOutput) {
            if ($line) { Log "restart: $line" }
        }
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
        if (-not $ngrokProcessHealthy) { $missing += 'ngrok process' }
        elseif (-not $ngrokTunnelHealthy) { $missing += 'ngrok active tunnel' }
        Log "UNHEALTHY: $($missing -join ', ')"

        $now = Get-Date
        $cooldownActive = ($now - $lastRestartAt) -lt $restartCooldown
        if ($restartJob) {
            Log "Autorestart already in progress; waiting for its result"
        } elseif ($cooldownActive) {
            Log "Autorestart suppressed for $([int]($restartCooldown - ($now - $lastRestartAt)).TotalSeconds)s cooldown"
        } else {
            # A live ngrok process without a tunnel is a stale process. Stop it
            # even on the unhealthy path; otherwise the old start_all.ps1 keeps
            # its mutex and every recovery attempt is rejected as a duplicate.
            if ($ngrokProcessHealthy) {
                Stop-Process -Id $ng.Id -Force -ErrorAction SilentlyContinue
            }
            $apiPid = $null
            $ngrokPid = $null
            Log "Autorestart: launching start_all.ps1"
            $startScript = Join-Path $PSScriptRoot "start_all.ps1"
            $restartLog = Join-Path $PSScriptRoot "start_run.log"
            $restartJob = Start-Job -ScriptBlock {
                param($scriptPath, $logPath)
                $ErrorActionPreference = 'Continue'
                Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') watchdog restart requested"

                # Stopping ngrok makes an older launcher leave its keep-alive loop.
                # Give it time to release the named mutex before starting again.
                $staleNgrok = Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue
                if ($staleNgrok) {
                    $staleNgrok | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 2
                }

                # The previous start_all.ps1 may still be unwinding after ngrok
                # exits. Do not race its named mutex and silently lose recovery.
                $startMutex = [System.Threading.Mutex]::new($false, 'Local\HabrCompanies.RestApiNgrok.StartAll')
                $mutexAcquired = $false
                for ($attempt = 0; $attempt -lt 15 -and -not $mutexAcquired; $attempt++) {
                    try { $mutexAcquired = $startMutex.WaitOne(0) }
                    catch [System.Threading.AbandonedMutexException] { $mutexAcquired = $true }
                    if (-not $mutexAcquired) { Start-Sleep -Seconds 1 }
                }
                if ($mutexAcquired) {
                    $startMutex.ReleaseMutex()
                } else {
                    Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') start_all mutex remained busy after 15s"
                }
                $startMutex.Dispose()
                if (-not $mutexAcquired) { exit 1 }

                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath 2>&1 |
                    ForEach-Object {
                        Add-Content -Path $logPath -Value $_
                        $_
                    } | Out-Null
                $exitCode = $LASTEXITCODE
                Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') watchdog restart exit_code=$exitCode"
                exit $exitCode
            } -ArgumentList $startScript, $restartLog
            $lastRestartAt = $now
        }
    }

    Start-Sleep -Seconds $CheckInterval
}
