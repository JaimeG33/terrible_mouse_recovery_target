param(
    [string]$StartUrl = "https://myebooks.mheducation.com/bookshelf/ebooks",
    [int]$Port = 9222
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProfilePath = Join-Path $ProjectRoot ".chrome-profile"

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

Write-Host "Starting dedicated Chrome debugging profile..."
Write-Host "Profile: $ProfilePath"
Write-Host "CDP port: $Port"
Write-Host ""
Write-Host "Use this Chrome window for the McGraw Hill reader."
Write-Host "You may need to sign in once in this dedicated profile."

$arguments = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$ProfilePath",
    "--no-first-run",
    "--no-default-browser-check",
    $StartUrl
)

Start-Process -FilePath $Chrome -ArgumentList $arguments
