param([int]$Port = 8766)
$ErrorActionPreference = 'Stop'
$trafficRoot = $PSScriptRoot
$trafficUrl = "http://127.0.0.1:$Port"
try {
    $trafficCheck = Invoke-RestMethod "$trafficUrl/api/meta" -TimeoutSec 2
    if ($trafficCheck.source -and $trafficCheck.frames) {
        Start-Process $trafficUrl
        Write-Host "Traffic Copilot is already running: $trafficUrl"
        exit 0
    }
} catch { }
$trafficPython = (Get-Command python -ErrorAction Stop).Source
$trafficProcess = Start-Process -FilePath $trafficPython -ArgumentList @('server.py', '--port', "$Port") -WorkingDirectory $trafficRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $trafficRoot 'server.log') -RedirectStandardError (Join-Path $trafficRoot 'server-error.log')
$trafficProcess.Id | Set-Content (Join-Path $trafficRoot '.server.pid')
for ($trafficAttempt = 0; $trafficAttempt -lt 40; $trafficAttempt++) {
    Start-Sleep -Milliseconds 250
    if ($trafficProcess.HasExited) { throw 'Server exited. Read server-error.log.' }
    try {
        $trafficCheck = Invoke-RestMethod "$trafficUrl/api/meta" -TimeoutSec 1
        if ($trafficCheck.frames) { Start-Process $trafficUrl; Write-Host "Traffic Copilot: $trafficUrl"; exit 0 }
    } catch { }
}
throw 'Server did not become ready. Read server-error.log.'

