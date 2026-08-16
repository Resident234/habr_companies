# trim_log.ps1 - shared log trimmer (Trim-LogLines / Trim-LogBytes)
function Trim-LogLines([string]$path, [int]$max) {
    if (-not (Test-Path $path)) { return }
    $lines = [IO.File]::ReadAllLines($path)
    if ($lines.Count -gt $max) {
        [IO.File]::WriteAllLines($path, $lines[($lines.Count - $max)..($lines.Count - 1)])
    }
}

function Trim-LogBytes([string]$path, [int64]$max) {
    if (-not (Test-Path $path)) { return }
    $info = [IO.FileInfo]$path
    if ($info.Length -gt $max) {
        $stream = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read)
        try {
            $seek = $info.Length - $max
            $stream.Seek($seek, [IO.SeekOrigin]::Begin) | Out-Null
            $buf = New-Object byte[] $max
            $n = $stream.Read($buf, 0, $max)
        } finally { $stream.Close() }
        [IO.File]::WriteAllBytes($path, $buf[0..($n - 1)])
    }
}
