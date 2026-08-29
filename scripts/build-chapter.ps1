param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter,

    [ValidateSet("auto", "normal", "safe", "plain")]
    [string]$Mode = "auto"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$previousChapter = $env:MHE_CHAPTER
$previousMode = $env:MHE_RENDER_MODE

function Invoke-Stage {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "STAGE: $Name"
    Write-Host "============================================================"
    Write-Host ""

    & $Command
    return $LASTEXITCODE
}

function Ask-Fallback {
    param(
        [string]$Reason
    )

    Write-Host ""
    Write-Host "Recovery fallback available."
    Write-Host $Reason
    Write-Host ""
    Write-Host "[1] Stop and re-record/repair the chapter (recommended for missing images/media)"
    Write-Host "[2] Continue with SAFE formatting (keeps semantic HTML/images where available)"
    Write-Host "[3] Continue with PLAIN text mode (maximum formatting tolerance)"
    Write-Host ""

    $choice = Read-Host "Choose 1, 2, or 3"

    switch ($choice) {
        "2" { return "safe" }
        "3" { return "plain" }
        default { return "stop" }
    }
}

Push-Location $ProjectRoot
try {
    $env:MHE_CHAPTER = [string]$Chapter
    $selectedMode = if ($Mode -eq "auto") { "normal" } else { $Mode }

    Write-Host ""
    Write-Host "Chapter build pipeline"
    Write-Host "Chapter: $Chapter"
    Write-Host "Requested mode: $Mode"
    Write-Host ""

    $exitCode = Invoke-Stage "1/6 - Chapter content validation" {
        npm run chapter:validate
    }

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Chapter content validation"
        Write-Host "The application believes XHTML/text content is missing."
        Write-Host "Formatting fallbacks are NOT used for known missing text."
        Write-Host ""
        Write-Host "Recommended:"
        Write-Host "  .\scripts\chapter.ps1 -Chapter $Chapter -Action record"
        exit $exitCode
    }

    $exitCode = Invoke-Stage "2/6 - Build asset inventory" {
        npm run assets:inventory
    }

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Asset inventory"
        exit $exitCode
    }

    $exitCode = Invoke-Stage "3/6 - Match one-pass staged assets" {
        npm run assets:promote
    }

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Staged asset promotion"
        exit $exitCode
    }

    $assetExit = Invoke-Stage "4/6 - Asset validation" {
        npm run assets:validate
    }

    if ($assetExit -ne 0 -and $selectedMode -eq "normal") {
        if ($Mode -eq "auto") {
            $fallback = Ask-Fallback `
                "Some direct assets are missing. The report above shows whether they are formatting resources or visual/media content."

            if ($fallback -eq "stop") {
                Write-Host ""
                Write-Host "BUILD STOPPED"
                Write-Host "Stage: Asset validation"
                Write-Host ""
                Write-Host "Re-record the chapter once. The one-pass recorder will keep existing good captures and stage anything newly observed."
                exit $assetExit
            }

            $selectedMode = $fallback
        } else {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Asset validation"
            exit $assetExit
        }
    }

    $env:MHE_RENDER_MODE = $selectedMode

    $assembleExit = Invoke-Stage "5/6 - Assemble continuous chapter ($selectedMode mode)" {
        npm run assemble
    }

    if ($assembleExit -ne 0 -and $Mode -eq "auto" -and $selectedMode -eq "normal") {
        $fallback = Ask-Fallback `
            "Normal publisher formatting could not be assembled, but chapter content validation passed."

        if ($fallback -eq "stop") {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Assembly"
            exit $assembleExit
        }

        $selectedMode = $fallback
        $env:MHE_RENDER_MODE = $selectedMode

        $assembleExit = Invoke-Stage "5/6 - Retry assembly ($selectedMode mode)" {
            npm run assemble
        }
    }

    if ($assembleExit -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Assembly"
        Write-Host "Mode attempted: $selectedMode"
        exit $assembleExit
    }

    $pdfExit = Invoke-Stage "6/6 - Render PDF" {
        npm run pdf
    }

    if ($pdfExit -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: PDF rendering"
        Write-Host "The assembled HTML still exists and can be opened directly."
        Write-Host "Ensure the dedicated Chrome session is running, then retry Action pdf or Action build."
        exit $pdfExit
    }

    $runtimeRoot = node -e "import('./src/config.mjs').then(m=>console.log(m.RUNTIME_ROOT))"
    $chapterLabel = "chapter{0:D2}" -f $Chapter
    $outputRoot = Join-Path $runtimeRoot "output\$chapterLabel"
    $reportPath = Join-Path $outputRoot "build-report.json"

    $report = [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString("o")
        chapterNumber = $Chapter
        renderMode = $selectedMode
        status = "success"
        html = (Join-Path $outputRoot "$chapterLabel.html")
        pdf = (Join-Path $outputRoot "$chapterLabel.pdf")
    }

    $report | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $reportPath

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "BUILD COMPLETE"
    Write-Host "============================================================"
    Write-Host "Chapter: $Chapter"
    Write-Host "Render mode: $selectedMode"
    Write-Host "PDF: $($report.pdf)"
    Write-Host "Report: $reportPath"
    Write-Host ""
}
finally {
    Pop-Location

    if ($null -eq $previousChapter) {
        Remove-Item Env:MHE_CHAPTER -ErrorAction SilentlyContinue
    } else {
        $env:MHE_CHAPTER = $previousChapter
    }

    if ($null -eq $previousMode) {
        Remove-Item Env:MHE_RENDER_MODE -ErrorAction SilentlyContinue
    } else {
        $env:MHE_RENDER_MODE = $previousMode
    }
}
