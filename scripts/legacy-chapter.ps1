param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter,

    [Parameter(Mandatory=$true)]
    [ValidateSet(
        "select",
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

    [ValidateSet(
        "normal",
        "safe",
        "plain"
    )]
    [string]$Mode = "normal"
)

$ErrorActionPreference = "Stop"

$ProjectRoot =
    Split-Path -Parent $PSScriptRoot

$previousChapter =
    $env:MHE_CHAPTER

$previousMode =
    $env:MHE_RENDER_MODE

function Invoke-NodeStage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Label,

        [Parameter(Mandatory=$true)]
        [string[]]$Arguments
    )

    Write-Host ""
    Write-Host "LEGACY STAGE: $Label"
    Write-Host ""

    & node @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw (
            "$Label failed with exit code " +
            "$LASTEXITCODE."
        )
    }
}

Push-Location $ProjectRoot

try {
    $env:MHE_CHAPTER =
        [string]$Chapter

    $env:MHE_RENDER_MODE =
        $Mode

    Write-Host ""
    Write-Host (
        "Legacy chapter workflow - Chapter " +
        "$Chapter"
    )
    Write-Host (
        "Action: $Action"
    )
    Write-Host ""

    switch ($Action) {
        "select" {
            Invoke-NodeStage `
                -Label "Select current book" `
                -Arguments @(
                    "src/book-manager.mjs",
                    "use-current"
                )
        }

        "capture" {
            # The old pre-multi-book workflow did not have a separate
            # book-selection step. Do it automatically here, then launch
            # the historical standalone XHTML watcher.
            Invoke-NodeStage `
                -Label "Select current book" `
                -Arguments @(
                    "src/book-manager.mjs",
                    "use-current"
                )

            Invoke-NodeStage `
                -Label "XHTML capture watcher" `
                -Arguments @(
                    "src/capture.mjs"
                )
        }

        "inventory" {
            Invoke-NodeStage `
                -Label "Asset inventory" `
                -Arguments @(
                    "src/assets.mjs",
                    "inventory"
                )
        }

        "assets" {
            Invoke-NodeStage `
                -Label "Browser-response asset capture" `
                -Arguments @(
                    "src/assets-capture.mjs"
                )
        }

        "validate" {
            Invoke-NodeStage `
                -Label "Chapter XHTML validation" `
                -Arguments @(
                    "src/chapter-health.mjs"
                )

            Invoke-NodeStage `
                -Label "Asset validation" `
                -Arguments @(
                    "src/asset-health.mjs"
                )
        }

        "assemble" {
            Invoke-NodeStage `
                -Label "Assemble HTML ($Mode)" `
                -Arguments @(
                    "src/assemble.mjs"
                )
        }

        "pdf" {
            Invoke-NodeStage `
                -Label "Render PDF" `
                -Arguments @(
                    "src/render-pdf.mjs"
                )
        }

        "proof" {
            Invoke-NodeStage `
                -Label "Asset validation" `
                -Arguments @(
                    "src/asset-health.mjs"
                )

            Invoke-NodeStage `
                -Label "Assemble HTML ($Mode)" `
                -Arguments @(
                    "src/assemble.mjs"
                )

            Invoke-NodeStage `
                -Label "Render PDF" `
                -Arguments @(
                    "src/render-pdf.mjs"
                )
        }

        "status" {
            Invoke-NodeStage `
                -Label "Capture status" `
                -Arguments @(
                    "src/status.mjs"
                )
        }
    }
}
finally {
    Pop-Location

    if ($null -eq $previousChapter) {
        Remove-Item `
            Env:MHE_CHAPTER `
            -ErrorAction SilentlyContinue
    } else {
        $env:MHE_CHAPTER =
            $previousChapter
    }

    if ($null -eq $previousMode) {
        Remove-Item `
            Env:MHE_RENDER_MODE `
            -ErrorAction SilentlyContinue
    } else {
        $env:MHE_RENDER_MODE =
            $previousMode
    }
}
