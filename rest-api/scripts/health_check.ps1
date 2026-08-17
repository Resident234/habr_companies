[CmdletBinding()]
param(
    [string]$BaseUrl,
    [string]$LocalUrl = "http://127.0.0.1:8080",
    [string]$CompanyCode = "pari_blog",
    [string]$ConfigPath,
    [string]$EnvPath,
    [string]$LogPath,
    [int]$TimeoutSec = 10,
    [switch]$SkipLocal,
    [switch]$SkipPublic
)

$ErrorActionPreference = "Stop"
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot "..\..\browser-extension\config.js" }
if (-not $EnvPath) { $EnvPath = Join-Path $PSScriptRoot "..\.env" }
if (-not $LogPath) { $LogPath = Join-Path $PSScriptRoot "health_check.log" }
$script:FailureCount = 0

function Get-JsConfigValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Config file not found: $Path"
    }

    $content = Get-Content -LiteralPath $Path -Raw
    $pattern = '(?m)^\s*' + [regex]::Escape($Name) + '\s*:\s*[''\"]([^''\"]+)[''\"]'
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        throw "Config value '$Name' was not found in $Path"
    }

    return $match.Groups[1].Value.Trim()
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        if ($separator -le 0) {
            continue
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        if ($key -ne $Name) {
            continue
        }

        $value = $trimmed.Substring($separator + 1).Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        return $value
    }

    return $null
}

function Add-CheckResult {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Healthy,
        [Parameter(Mandatory = $true)][string]$Detail
    )

    $state = if ($Healthy) { "PASS" } else { "FAIL" }
    if (-not $Healthy) {
        $script:FailureCount++
    }

    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
    $safeDetail = $Detail -replace "\r?\n", " "
    Add-Content -LiteralPath $LogPath -Value "$timestamp`t$state`t$Name`t$safeDetail"

    $color = if ($Healthy) { "Green" } else { "Red" }
    Write-Host ("[{0}] {1}: {2}" -f $state, $Name, $Detail) -ForegroundColor $color
}

function Test-JsonEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][hashtable]$Headers
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest `
            -Uri $Uri `
            -Method Get `
            -Headers $Headers `
            -UseBasicParsing `
            -TimeoutSec $TimeoutSec

        $stopwatch.Stop()
        if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) {
            throw "HTTP status $([int]$response.StatusCode)"
        }

        try {
            $null = $response.Content | ConvertFrom-Json -ErrorAction Stop
        } catch {
            throw "HTTP $([int]$response.StatusCode), but response is not valid JSON"
        }

        Add-CheckResult -Name $Name -Healthy $true -Detail ("HTTP {0}, JSON, {1} ms" -f [int]$response.StatusCode, $stopwatch.ElapsedMilliseconds)
        return $true
    } catch {
        $stopwatch.Stop()
        Add-CheckResult -Name $Name -Healthy $false -Detail ("{0} ({1} ms)" -f $_.Exception.Message, $stopwatch.ElapsedMilliseconds)
        return $false
    }
}

try {
    if (-not $BaseUrl) {
        $BaseUrl = Get-JsConfigValue -Path $ConfigPath -Name "DEFAULT_BASE_URL"
    }

    $apiKey = Get-EnvValue -Path $EnvPath -Name "COMPANY_API_KEY"
    if (-not $apiKey -and (Test-Path -LiteralPath $ConfigPath)) {
        $apiKey = Get-JsConfigValue -Path $ConfigPath -Name "API_KEY"
    }
    if (-not $apiKey) {
        throw "API key was not found in $EnvPath or $ConfigPath"
    }

    $baseUri = [System.Uri]::new($BaseUrl.TrimEnd('/') + '/')
    $localUri = [System.Uri]::new($LocalUrl.TrimEnd('/') + '/')
    $statusPath = "company/statuses/$([System.Uri]::EscapeDataString($CompanyCode))"
    $publicStatusUri = [System.Uri]::new($baseUri, $statusPath).AbsoluteUri
    $localStatusUri = [System.Uri]::new($localUri, $statusPath).AbsoluteUri
    $headers = @{
        "X-API-Key" = $apiKey
        "Accept" = "application/json"
        "ngrok-skip-browser-warning" = "true"
    }

    Write-Host "Health check started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host "Public endpoint: $publicStatusUri"
    Write-Host "Local endpoint:  $localStatusUri"

    if (-not $SkipLocal) {
        Test-JsonEndpoint -Name "REST API local" -Uri $localStatusUri -Headers $headers | Out-Null
    }

    try {
        $tunnelResponse = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -TimeoutSec $TimeoutSec
        $tunnels = @($tunnelResponse.tunnels)
        $matching = @($tunnels | Where-Object { $_.public_url.TrimEnd('/') -eq $BaseUrl.TrimEnd('/') })
        if ($tunnels.Count -ne 1) {
            Add-CheckResult -Name "ngrok tunnel count" -Healthy $false -Detail ("Expected 1 tunnel, found {0}" -f $tunnels.Count)
        } elseif ($matching.Count -ne 1) {
            Add-CheckResult -Name "ngrok URL" -Healthy $false -Detail "The configured URL is not the active tunnel URL"
        } else {
            Add-CheckResult -Name "ngrok tunnel" -Healthy $true -Detail ("1 active tunnel at {0}" -f $matching[0].public_url)
        }
    } catch {
        Add-CheckResult -Name "ngrok management API" -Healthy $false -Detail $_.Exception.Message
    }

    if (-not $SkipPublic) {
        Test-JsonEndpoint -Name "REST API through ngrok" -Uri $publicStatusUri -Headers $headers | Out-Null
    }
} catch {
    Add-CheckResult -Name "health-check configuration" -Healthy $false -Detail $_.Exception.Message
}

Write-Host ""
if ($script:FailureCount -eq 0) {
    Write-Host "HEALTHY: all checks passed" -ForegroundColor Green
    exit 0
}

Write-Host ("UNHEALTHY: {0} check(s) failed" -f $script:FailureCount) -ForegroundColor Red
exit 1
