param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 999)]
    [int]$Chapter,

    [ValidateSet(
        "auto",
        "normal",
        "safe",
        "plain",
        "partial-safe",
        "partial-plain"
    )]
    [string]$Mode = "auto"
)

$ErrorActionPreference = "Stop"

$ProjectRoot =
    Split-Path -Parent $PSScriptRoot

$previousChapter =
    $env:MHE_CHAPTER

$previousMode =
    $env:MHE_RENDER_MODE

$previousPartial =
    $env:MHE_PARTIAL_FALLBACK_FILES

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

    & npm.cmd run $ScriptName

    $script:LastStageExitCode =
        [int]$LASTEXITCODE
}

function Get-ActiveRuntimeRoot {
    $activePath =
        Join-Path $ProjectRoot "books\active.json"

    if (-not (Test-Path $activePath)) {
        throw "books\active.json is missing."
    }

    $active =
        Get-Content -Raw $activePath |
        ConvertFrom-Json

    if (-not $active.bookId) {
        throw "No active book ID is set."
    }

    return (
        Join-Path $ProjectRoot (
            "books\" + $active.bookId
        )
    )
}

function Get-ProblemFragments {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RuntimeRoot
    )

    $chapterLabel =
        "chapter{0:D2}" -f $Chapter

    $healthPath =
        Join-Path $RuntimeRoot (
            "assets\" +
            $chapterLabel +
            "\health-report.json"
        )

    if (-not (Test-Path $healthPath)) {
        return @()
    }

    $health =
        Get-Content -Raw $healthPath |
        ConvertFrom-Json

    $fragments = @()

    if ($health.problemFragments) {
        foreach (
            $fragment in
            @($health.problemFragments)
        ) {
            if (
                $fragment -and
                $fragment.ToString().EndsWith(
                    ".xhtml",
                    [StringComparison]::OrdinalIgnoreCase
                )
            ) {
                $fragments +=
                    $fragment.ToString()
            }
        }
    }
    elseif ($health.missing) {
        foreach (
            $missing in
            @($health.missing)
        ) {
            foreach (
                $source in
                @($missing.referencedBy)
            ) {
                if (
                    $source -and
                    $source.ToString().EndsWith(
                        ".xhtml",
                        [StringComparison]::OrdinalIgnoreCase
                    )
                ) {
                    $fragments +=
                        $source.ToString()
                }
            }
        }
    }

    return @(
        $fragments |
        Sort-Object -Unique
    )
}

function Set-PartialTargets {
    param(
        [string[]]$Fragments
    )

    if (-not $Fragments -or $Fragments.Count -eq 0) {
        Remove-Item `
            Env:MHE_PARTIAL_FALLBACK_FILES `
            -ErrorAction SilentlyContinue

        return
    }

    $env:MHE_PARTIAL_FALLBACK_FILES =
        ($Fragments -join ";")

    Write-Host ""
    Write-Host "Partial fallback will be limited to:"
    foreach ($fragment in $Fragments) {
        Write-Host "  - $fragment"
    }
}

function Clear-PartialTargets {
    Remove-Item `
        Env:MHE_PARTIAL_FALLBACK_FILES `
        -ErrorAction SilentlyContinue
}

function Ask-Fallback {
    param(
        [string]$Reason,
        [bool]$AllowPartial = $false
    )

    Write-Host ""
    Write-Host "Recovery fallback available."
    Write-Host $Reason
    Write-Host ""
    Write-Host "[1] Stop and re-record/repair the affected page/fragment"
    Write-Host "[2] Continue with SAFE formatting for the whole chapter"
    Write-Host "[3] Continue with BARE-BONES text formatting for the whole chapter"

    if ($AllowPartial) {
        Write-Host "[4] Keep normal formatting except the affected page/fragment(s)"
    }

    Write-Host ""

    if ($AllowPartial) {
        $choice =
            Read-Host "Choose 1, 2, 3, or 4"
    } else {
        $choice =
            Read-Host "Choose 1, 2, or 3"
    }

    switch ($choice) {
        "2" {
            return "safe"
        }

        "3" {
            return "plain"
        }

        "4" {
            if (-not $AllowPartial) {
                return "stop"
            }

            Write-Host ""
            Write-Host "Affected page/fragment fallback:"
            Write-Host "[1] SAFE formatting only there"
            Write-Host "[2] BARE-BONES text only there"
            Write-Host ""

            $partialChoice =
                Read-Host "Choose 1 or 2"

            if ($partialChoice -eq "2") {
                return "partial-plain"
            }

            return "partial-safe"
        }

        default {
            return "stop"
        }
    }
}

function Get-VariantSuffix {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RenderMode
    )

    switch ($RenderMode) {
        "safe" {
            return "_safe-formatting"
        }

        "plain" {
            return "_bare-bones"
        }

        "partial-safe" {
            return "_partial-safe"
        }

        "partial-plain" {
            return "_partial-bare-bones"
        }

        default {
            return ""
        }
    }
}

function Retry-WholeChapterFallback {
    param(
        [string]$Reason
    )

    Clear-PartialTargets

    $fallback =
        Ask-Fallback `
            -Reason $Reason `
            -AllowPartial $false

    if ($fallback -eq "stop") {
        return $null
    }

    return $fallback
}

Push-Location $ProjectRoot

try {
    $env:MHE_CHAPTER =
        [string]$Chapter

    $runtimeRoot =
        Get-ActiveRuntimeRoot

    $selectedMode =
        if ($Mode -eq "auto") {
            "normal"
        } else {
            $Mode
        }

    Write-Host ""
    Write-Host "Chapter build pipeline"
    Write-Host "Chapter: $Chapter"
    Write-Host "Requested mode: $Mode"
    Write-Host ""

    Invoke-NpmStage `
        -Name "1/6 - Chapter content validation" `
        -ScriptName "chapter:validate"

    $exitCode =
        [int]$script:LastStageExitCode

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

    $exitCode =
        [int]$script:LastStageExitCode

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Asset inventory"
        exit $exitCode
    }

    Invoke-NpmStage `
        -Name "3/6 - Match one-pass staged assets" `
        -ScriptName "assets:promote"

    $exitCode =
        [int]$script:LastStageExitCode

    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: Staged asset promotion"
        exit $exitCode
    }

    Invoke-NpmStage `
        -Name "4/6 - Asset validation" `
        -ScriptName "assets:validate"

    $assetExit =
        [int]$script:LastStageExitCode

    $problemFragments =
        @(Get-ProblemFragments `
            -RuntimeRoot $runtimeRoot)

    if (
        $selectedMode.StartsWith(
            "partial-"
        )
    ) {
        Set-PartialTargets `
            -Fragments $problemFragments
    }

    if ($assetExit -ne 0) {
        if ($Mode -eq "auto") {
            $allowPartial =
                ($problemFragments.Count -gt 0)

            $fallback =
                Ask-Fallback `
                    -Reason "Some direct assets are missing. The report above identifies the affected captured fragment(s)." `
                    -AllowPartial $allowPartial

            if ($fallback -eq "stop") {
                Write-Host ""
                Write-Host "BUILD STOPPED"
                Write-Host "Stage: Asset validation"
                Write-Host ""
                Write-Host "Re-run record and revisit only the affected page/fragment if the rest of the chapter is already complete."
                exit $assetExit
            }

            $selectedMode =
                $fallback

            if (
                $selectedMode.StartsWith(
                    "partial-"
                )
            ) {
                Set-PartialTargets `
                    -Fragments $problemFragments
            } else {
                Clear-PartialTargets
            }
        }
        elseif ($selectedMode -eq "normal") {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Asset validation"
            exit $assetExit
        }
    }

    $env:MHE_RENDER_MODE =
        $selectedMode

    Invoke-NpmStage `
        -Name "5/6 - Assemble continuous chapter ($selectedMode mode)" `
        -ScriptName "assemble"

    $assembleExit =
        [int]$script:LastStageExitCode

    if (
        $assembleExit -ne 0 -and
        $Mode -eq "auto" -and
        $selectedMode.StartsWith(
            "partial-"
        )
    ) {
        $replacement =
            Retry-WholeChapterFallback `
                -Reason "The partial fallback attempt failed. The partial option will not be offered again for this build."

        if ($null -eq $replacement) {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Partial assembly"
            exit $assembleExit
        }

        $selectedMode =
            $replacement

        $env:MHE_RENDER_MODE =
            $selectedMode

        Invoke-NpmStage `
            -Name "5/6 - Retry assembly ($selectedMode mode)" `
            -ScriptName "assemble"

        $assembleExit =
            [int]$script:LastStageExitCode
    }
    elseif (
        $assembleExit -ne 0 -and
        $Mode -eq "auto" -and
        $selectedMode -eq "normal"
    ) {
        $replacement =
            Retry-WholeChapterFallback `
                -Reason "Normal publisher formatting could not be assembled."

        if ($null -eq $replacement) {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Assembly"
            exit $assembleExit
        }

        $selectedMode =
            $replacement

        $env:MHE_RENDER_MODE =
            $selectedMode

        Invoke-NpmStage `
            -Name "5/6 - Retry assembly ($selectedMode mode)" `
            -ScriptName "assemble"

        $assembleExit =
            [int]$script:LastStageExitCode
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

    $pdfExit =
        [int]$script:LastStageExitCode

    if (
        $pdfExit -ne 0 -and
        $Mode -eq "auto" -and
        $selectedMode.StartsWith(
            "partial-"
        )
    ) {
        $replacement =
            Retry-WholeChapterFallback `
                -Reason "The partial-format PDF attempt failed. The partial option will not be offered again for this build."

        if ($null -eq $replacement) {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: PDF rendering"
            exit $pdfExit
        }

        $selectedMode =
            $replacement

        $env:MHE_RENDER_MODE =
            $selectedMode

        Invoke-NpmStage `
            -Name "5/6 - Retry assembly ($selectedMode mode)" `
            -ScriptName "assemble"

        if (
            [int]$script:LastStageExitCode -ne 0
        ) {
            Write-Host ""
            Write-Host "BUILD STOPPED"
            Write-Host "Stage: Fallback assembly"
            exit ([int]$script:LastStageExitCode)
        }

        Invoke-NpmStage `
            -Name "6/6 - Retry PDF ($selectedMode mode)" `
            -ScriptName "pdf"

        $pdfExit =
            [int]$script:LastStageExitCode
    }

    if ($pdfExit -ne 0) {
        Write-Host ""
        Write-Host "BUILD STOPPED"
        Write-Host "Stage: PDF rendering"
        Write-Host "The assembled HTML still exists and can be opened directly."
        Write-Host "Ensure dedicated Chrome is running before retrying."
        exit $pdfExit
    }

    $chapterLabel =
        "chapter{0:D2}" -f $Chapter

    $suffix =
        Get-VariantSuffix `
            -RenderMode $selectedMode

    $outputBase =
        $chapterLabel + $suffix

    $outputRoot =
        Join-Path $runtimeRoot (
            "output\" +
            $chapterLabel
        )

    $reportPath =
        Join-Path $outputRoot (
            "build-report" +
            $suffix +
            ".json"
        )

    $report =
        [ordered]@{
            schemaVersion = 2
            generatedAt =
                (Get-Date).ToString("o")
            chapterNumber =
                $Chapter
            renderMode =
                $selectedMode
            partialFallbackFragments =
                @(
                    if (
                        $selectedMode.StartsWith(
                            "partial-"
                        )
                    ) {
                        $problemFragments
                    }
                )
            status =
                "success"
            html =
                (
                    Join-Path $outputRoot (
                        $outputBase +
                        ".html"
                    )
                )
            pdf =
                (
                    Join-Path $outputRoot (
                        $outputBase +
                        ".pdf"
                    )
                )
        }

    $report |
        ConvertTo-Json -Depth 6 |
        Set-Content `
            -Encoding UTF8 `
            $reportPath

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

    if ($null -eq $previousPartial) {
        Remove-Item `
            Env:MHE_PARTIAL_FALLBACK_FILES `
            -ErrorAction SilentlyContinue
    } else {
        $env:MHE_PARTIAL_FALLBACK_FILES =
            $previousPartial
    }
}
