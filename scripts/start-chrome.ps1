param(
    [string]$StartUrl = "https://myebooks.mheducation.com/bookshelf/ebooks",
    [int]$Port = 9222
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProfilePath = Join-Path $ProjectRoot ".chrome-profile"
$HealthUrl = "http://127.0.0.1:$Port/json/version"

try {
    $existing = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 1
    if ($existing) {
        Write-Host ""
        Write-Host "Dedicated Chrome debugging session is already running on port $Port."
        Write-Host "Use the existing dedicated Chrome window instead of opening another one."
        Write-Host ""
        exit 0
    }
} catch {
    # Expected when the dedicated session is not already running.
}

$candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$Chrome = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $Chrome) {
    throw "Google Chrome was not found in the standard install locations."
}

New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null

Write-Host ""
Write-Host "Starting dedicated Chrome debugging profile..."
Write-Host "Profile: $ProfilePath"
Write-Host "CDP: http://127.0.0.1:$Port"
Write-Host ""
Write-Host "Use this Chrome window for the McGraw Hill reader."
Write-Host "This is a separate Chrome profile and may keep your McGraw Hill login until the site expires it or you sign out."
Write-Host ""

$arguments = @(
    "--remote-debugging-port=$Port",
    "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=$ProfilePath",
    "--disable-background-mode",
    "--no-first-run",
    "--no-default-browser-check",
    $StartUrl
)

Start-Process -FilePath $Chrome -ArgumentList $arguments | Out-Null
