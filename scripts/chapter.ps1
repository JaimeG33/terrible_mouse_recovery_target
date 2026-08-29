param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter,

    [Parameter(Mandatory=$true)]
    [ValidateSet("capture", "inventory", "assets", "validate", "assemble", "pdf", "proof", "status")]
    [string]$Action
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$previousChapter = $env:MHE_CHAPTER

Push-Location $ProjectRoot
try {
    $env:MHE_CHAPTER = [string]$Chapter

    Write-Host ""
    Write-Host "Chapter scope: $Chapter"
    Write-Host "Action: $Action"
    Write-Host ""

    switch ($Action) {
        "capture" {
            Write-Host "Only Chapter $Chapter will be saved. Other chapters are ignored by the content watcher."
            npm run capture
        }
        "inventory" {
            npm run assets:inventory
        }
        "assets" {
            Write-Host "Manually navigate/scroll Chapter $Chapter while this watcher is running."
            npm run assets:capture
        }
        "validate" {
            npm run assets:validate
        }
        "assemble" {
            npm run assemble
        }
        "pdf" {
            npm run pdf
        }
        "proof" {
            npm run proof
        }
        "status" {
            npm run status
        }
    }

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location

    if ($null -eq $previousChapter) {
        Remove-Item Env:MHE_CHAPTER -ErrorAction SilentlyContinue
    } else {
        $env:MHE_CHAPTER = $previousChapter
    }
}
