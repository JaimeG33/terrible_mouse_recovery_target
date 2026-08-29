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
$script:LastNpmExitCode = 0

function Invoke-NpmCmd {
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Arguments
    )

    # Run as a statement, not as a function whose combined stdout/return value
    # is assigned by the caller. See STEP5_2_4_BUILD_PIPELINE_FIX.md.
    & npm.cmd @Arguments
    $script:LastNpmExitCode = [int]$LASTEXITCODE
}

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

            & node "src/book-manager.mjs" "use-current"
            if ($LASTEXITCODE -ne 0) {
                throw "Could not select the current book."
            }

            Write-Host ""
            Write-Host "Launching one-pass chapter recorder..."
            Write-Host "Do not navigate until the terminal prints ONE-PASS CHAPTER RECORDING READY."
            Write-Host ""

            & node "src/record.mjs"

            if ($LASTEXITCODE -ne 0) {
                throw "One-pass chapter recording failed with exit code $LASTEXITCODE."
            }
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
            Invoke-NpmCmd -Arguments @("run", "capture")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "inventory" {
            Invoke-NpmCmd -Arguments @("run", "assets:inventory")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "assets" {
            Write-Host "Low-level asset-only watcher. Prefer Action record for normal use."
            Invoke-NpmCmd -Arguments @("run", "assets:capture")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "validate" {
            Invoke-NpmCmd -Arguments @("run", "chapter:validate")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }

            Invoke-NpmCmd -Arguments @("run", "assets:validate")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "assemble" {
            Invoke-NpmCmd -Arguments @("run", "assemble")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "pdf" {
            Invoke-NpmCmd -Arguments @("run", "pdf")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "proof" {
            Invoke-NpmCmd -Arguments @("run", "proof")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }

        "status" {
            Invoke-NpmCmd -Arguments @("run", "status")
            $code = [int]$script:LastNpmExitCode
            if ($code -ne 0) { exit $code }
        }
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
