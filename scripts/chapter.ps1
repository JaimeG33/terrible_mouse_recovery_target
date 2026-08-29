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

function Invoke-NpmCmd {
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Arguments
    )

    & npm.cmd @Arguments
    return $LASTEXITCODE
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

            # IMPORTANT:
            # Invoke Node directly here rather than chaining two `npm run` calls.
            # On Windows PowerShell, `npm` may resolve to npm.ps1. The npm PowerShell
            # shim ends with `exit $LASTEXITCODE`; depending on the calling scope,
            # that can terminate this wrapper after book selection before the
            # second command (`record`) ever starts.
            & node "src/book-manager.mjs" "use-current"
            if ($LASTEXITCODE -ne 0) {
                throw "Could not select the current book."
            }

            Write-Host ""
            Write-Host "Launching one-pass chapter recorder..."
            Write-Host "Do not navigate until the terminal prints ONE-PASS CHAPTER RECORDING READY."
            Write-Host ""

            # Separate Node process is deliberate: config.mjs must load AFTER
            # book-manager writes books/active.json so ACTIVE_BOOK_ID is current.
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
            $code = Invoke-NpmCmd -Arguments @("run", "capture")
            if ($code -ne 0) { exit $code }
        }

        "inventory" {
            $code = Invoke-NpmCmd -Arguments @("run", "assets:inventory")
            if ($code -ne 0) { exit $code }
        }

        "assets" {
            Write-Host "Low-level asset-only watcher. Prefer Action record for normal use."
            $code = Invoke-NpmCmd -Arguments @("run", "assets:capture")
            if ($code -ne 0) { exit $code }
        }

        "validate" {
            $code = Invoke-NpmCmd -Arguments @("run", "chapter:validate")
            if ($code -ne 0) { exit $code }

            $code = Invoke-NpmCmd -Arguments @("run", "assets:validate")
            if ($code -ne 0) { exit $code }
        }

        "assemble" {
            $code = Invoke-NpmCmd -Arguments @("run", "assemble")
            if ($code -ne 0) { exit $code }
        }

        "pdf" {
            $code = Invoke-NpmCmd -Arguments @("run", "pdf")
            if ($code -ne 0) { exit $code }
        }

        "proof" {
            $code = Invoke-NpmCmd -Arguments @("run", "proof")
            if ($code -ne 0) { exit $code }
        }

        "status" {
            $code = Invoke-NpmCmd -Arguments @("run", "status")
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
