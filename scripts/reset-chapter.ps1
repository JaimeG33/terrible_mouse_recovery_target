param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$previousChapter = $env:MHE_CHAPTER
$previousReset = $env:MHE_RESET_LEVEL
$previousReader = $env:MHE_READER

Push-Location $ProjectRoot
try {
    $env:MHE_CHAPTER = [string]$Chapter

    Write-Host ""
    Write-Host "Reset / Retry Chapter $Chapter"
    Write-Host ""
    Write-Host "Existing data is backed up before removal."
    Write-Host ""
    Write-Host "[1] Rebuild output only"
    Write-Host "    Clears generated HTML/PDF. Keeps recording and assets."
    Write-Host ""
    Write-Host "[2] Reset chapter assets"
    Write-Host "    Clears assets, one-pass staging, and output. Keeps XHTML recording."
    Write-Host ""
    Write-Host "[3] Reset entire chapter recording"
    Write-Host "    Clears this chapter's XHTML, assets, staging, and output."
    Write-Host ""
    Write-Host "[4] Reset one reader_N fragment"
    Write-Host "    Removes one recorded reader fragment plus derived chapter assets/output."
    Write-Host ""
    Write-Host "[5] Cancel"
    Write-Host ""

    $choice = Read-Host "Choose 1-5"

    switch ($choice) {
        "1" {
            $env:MHE_RESET_LEVEL = "output"
        }
        "2" {
            $env:MHE_RESET_LEVEL = "assets"
        }
        "3" {
            $confirm = Read-Host "Type RESET to confirm clearing Chapter $Chapter recording"
            if ($confirm -ne "RESET") {
                Write-Host "Cancelled."
                exit 0
            }
            $env:MHE_RESET_LEVEL = "recording"
        }
        "4" {
            $reader = Read-Host "Enter the reader_N number to remove (example: 8)"
            if ($reader -notmatch '^\d+$') {
                throw "Reader number must be numeric."
            }
            $env:MHE_READER = $reader
            $env:MHE_RESET_LEVEL = "fragment"
        }
        default {
            Write-Host "Cancelled."
            exit 0
        }
    }

    node src/reset-chapter.mjs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "You can now re-run Action record/build as needed."
}
finally {
    Pop-Location

    if ($null -eq $previousChapter) {
        Remove-Item Env:MHE_CHAPTER -ErrorAction SilentlyContinue
    } else {
        $env:MHE_CHAPTER = $previousChapter
    }

    if ($null -eq $previousReset) {
        Remove-Item Env:MHE_RESET_LEVEL -ErrorAction SilentlyContinue
    } else {
        $env:MHE_RESET_LEVEL = $previousReset
    }

    if ($null -eq $previousReader) {
        Remove-Item Env:MHE_READER -ErrorAction SilentlyContinue
    } else {
        $env:MHE_READER = $previousReader
    }
}
