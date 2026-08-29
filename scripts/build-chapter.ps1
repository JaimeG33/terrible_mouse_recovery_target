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

$script:LastStageExitCode = 0

function Invoke-NpmStage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$true)]
        [string]$ScriptName
    )

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "STAGE: $Name"
    Write-Host "============================================================"
    Write-Host ""

    # IMPORTANT:
    # Do not RETURN the exit code from this function while the caller assigns
    # the function result to a variable. External-command stdout is also
    # PowerShell pipeline output, so a call such as:
    #
    #   $exitCode = Invoke-NpmStage ...
    #
    # captures both npm's console text and the integer exit code. The resulting
    # array compares as nonzero even when npm actually exited 0, which made
    # successful validation look like a failure and also hid the stage output.
    #
    # Instead, let npm stream normally to the terminal and store the actual
    # process exit code in script scope.
    & npm.cmd run $ScriptName
    $script:LastStageExitCode = [int]$LASTEXITCODE
}

function Run-NpmStage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$true)]
        [string]$ScriptName
    )

    Invoke-NpmStage `
        -Name $Name `
        -ScriptName $ScriptName

    return [int]$script:LastStageExitCode
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

    # Call the stage as a standalone statement so its npm stdout remains
    # visible. Read the exit code afterward from script scope.
    Invoke-NpmStage `
        -Name "1/6 - Chapter content validation" `
        -ScriptName "chapter:validate"
    $exitCode = [int]$script:LastStageExitCode

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

    Invoke-NpmStage `
        -Name "2/6 - Build asset inventory" `
        -ScriptName "assets:inventory"
    $exitCode = [int]$script:LastStageExitCode

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Asset inventory"
        exit $exitCode
    }

    Invoke-NpmStage `
        -Name "3/6 - Match one-pass staged assets" `
        -ScriptName "assets:promote"
    $exitCode = [int]$script:LastStageExitCode

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Staged asset promotion"
        exit $exitCode
    }

    Invoke-NpmStage `
        -Name "4/6 - Asset validation" `
        -ScriptName "assets:validate"
    $assetExit = [int]$script:LastStageExitCode

    if ($assetExit -ne 0 -and $selectedMode -eq "normal") {
        if ($Mode -eq "auto") {
            $fallback = Ask-Fallback `
                "Some direct assets are missing. The report above shows whether they are formatting resources or visual/media content."

            if ($fallback -eq "stop") {
                Write-Host ""
                Write-Host "BUILD STOPPED"
                Write-Host "Stage: Asset validation"
                Write-Host ""
                Write-Host "Re-record the chapter once. The one-pass recorder keeps existing good captures and stages anything newly observed."
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

    Invoke-NpmStage `
        -Name "5/6 - Assemble continuous chapter ($selectedMode mode)" `
        -ScriptName "assemble"
    $assembleExit = [int]$script:LastStageExitCode

    if (
        $assembleExit -ne 0 -and
        $Mode -eq "auto" -and
        $selectedMode -eq "normal"
    ) {
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

        Invoke-NpmStage `
            -Name "5/6 - Retry assembly ($selectedMode mode)" `
            -ScriptName "assemble"
        $assembleExit = [int]$script:LastStageExitCode
    }

    if ($assembleExit -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Assembly"
        Write-Host "Mode attempted: $selectedMode"
        exit $assembleExit
    }

    Invoke-NpmStage `
        -Name "6/6 - Render PDF" `
        -ScriptName "pdf"
    $pdfExit = [int]$script:LastStageExitCode

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

    $report |
        ConvertTo-Json -Depth 5 |
        Set-Content -Encoding UTF8 $reportPath

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
