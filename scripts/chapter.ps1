param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter,

    [Parameter(Mandatory=$true)]
    [ValidateSet(
        "record",
        "build",
        "reset",
        "capture",
        "inventory",
        "assets",
        "validate",
        "assemble",
        "pdf",
        "proof",
        "status"
    )]
    [string]$Action,

    [ValidateSet("auto", "normal", "safe", "plain")]
    [string]$Mode = "auto"
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
        "record" {
            Write-Host "Selecting the McGraw Hill book currently open in the dedicated Chrome window..."
            npm run book:use-current
            if ($LASTEXITCODE -ne 0) {
                throw "Could not select the current book."
            }

            Write-Host ""
            npm run record
        }

        "build" {
            & (Join-Path $PSScriptRoot "build-chapter.ps1") `
                -Chapter $Chapter `
                -Mode $Mode
        }

        "reset" {
            & (Join-Path $PSScriptRoot "reset-chapter.ps1") `
                -Chapter $Chapter
        }

        "capture" {
            Write-Host "Low-level XHTML-only capture. Prefer Action record for normal use."
            npm run capture
        }

        "inventory" {
            npm run assets:inventory
        }

        "assets" {
            Write-Host "Low-level asset-only watcher. Prefer Action record for normal use."
            npm run assets:capture
        }

        "validate" {
            npm run chapter:validate
            if ($LASTEXITCODE -ne 0) {
                exit $LASTEXITCODE
            }
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
