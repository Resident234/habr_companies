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
$api0 = Get-Process -Name "rest-api" -ErrorAction SilentlyContinue
$ng0 = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
Log ("Initial state: rest-api=" + $(if ($api0) { 'PID ' + $api0.Id } else { 'down' }) + ", ngrok=" + $(if ($ng0) { 'PID ' + $ng0.Id } else { 'down' }))

while ($true) {
    $api = Get-Process -Name "rest-api" -ErrorAction SilentlyContinue
    $ng = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

    if ($api -and $api.Id -ne $apiPid) {
        Log "rest-api found, PID $($api.Id)"
        $apiPid = $api.Id
        }

    if ($api) {
        if ($ng) {
            if ($ng.Id -ne $ngrokPid) {
                Log "ngrok found, PID $($ng.Id)"
                $ngrokPid = $ng.Id
                }
            } else {
            Log "CRASH: ngrok missing while rest-api up (PID $apiPid)"
            $ngrokPid = $null
            }
        } else {
        if ($ng) {
            Log "CRASH: rest-api missing, ngrok up (PID $($ng.Id)); stopping ngrok"
            Stop-Process -Id $ng.Id -Force
            $ngrokPid = $null
            $apiPid = $nul
            }
        } else {
        if ($apiPid -ne $null -or $ngrokPid -ne $null) {
            Log "CRASH: both rest-api and ngrok down (last PIDs: rest-api=$apiPid, ngrok=$ngrokPid)"
            $apiPid = $null

                $ngrokPid = $null
                Log "Autorestart: launching start_all.ps1"
                Start-Job -ScriptBlock { powershell -ExecutionPolicy Bypass -File $args[0] 2>&1 | Out-Null } -ArgumentList (Join-Path $PSScriptRoot "start_all.ps1") | Out-Null
        }
    }

    Start-Sleep -Seconds $CheckInterval
}
