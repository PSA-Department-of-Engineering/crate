<#
.SYNOPSIS
    Start Crate for development: the Vite renderer and the Electron shell.

.DESCRIPTION
    `npm run dev` alone starts both, but it leaves both behind when the tree is
    killed, and that costs more here than a busy port would. Vite does not hold
    3000 strictly: with a stale server still on it, the next run quietly moves
    to 3001 and hands the new shell that URL, so the old server and its shell
    keep running and every run after stacks another pair. Port 3000 is also
    shared ground - most local dev servers want it - so this frees it only for a
    holder that names this repo, and reports a stranger's server rather than
    killing it. Orphaned shells are swept on the way in and on the way out.

.PARAMETER WebOnly
    Run the Vite renderer alone, for driving the UI in a browser. The desktop
    bridge is absent there and the renderer's `window.crateBridge` guards fall
    back cleanly.

.PARAMETER Force
    Free the dev port even when its holder cannot be attributed to this repo.

.EXAMPLE
    .\scripts\dev.ps1
#>
[CmdletBinding()]
param(
    [switch]$WebOnly,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
# Ctrl+C is how this script normally ends, and npm reports that as a non-zero
# exit. Under PowerShell 7.4+ that would otherwise become a terminating error
# on every clean shutdown.
$PSNativeCommandUseErrorActionPreference = $false

$RepoRoot = Split-Path -Parent $PSScriptRoot
# Named in vite.config.ts and dev-runner.js too; change it in all three.
$RendererPort = 3000
$ElectronBin = Join-Path $RepoRoot 'node_modules\electron'

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-Descendant {
    <# Every process below one, deepest last. #>
    param([int]$ProcessId)

    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Select-Object ProcessId, ParentProcessId)
    $found = New-Object System.Collections.ArrayList
    $frontier = @($ProcessId)

    while ($frontier.Count -gt 0) {
        $next = @()
        foreach ($id in $frontier) {
            foreach ($child in @($all | Where-Object { $_.ParentProcessId -eq $id })) {
                $childId = [int]$child.ProcessId
                if (-not $found.Contains($childId)) {
                    $null = $found.Add($childId)
                    $next += $childId
                }
            }
        }
        $frontier = $next
    }
    return $found.ToArray()
}

function Stop-Tree {
    <# Kill a process and everything under it, children first.

    The dev runner spawns Electron, and Electron spawns its own renderer, GPU
    and utility processes. `taskkill /T` would do this, but a native command's
    stderr turns into a terminating error under `$ErrorActionPreference =
    'Stop'`, and a process that already exited is the normal case here.
    #>
    param([int]$ProcessId)

    foreach ($id in (@(Get-Descendant -ProcessId $ProcessId) + @($ProcessId))) {
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
}

function Test-OurProcess {
    <# Does this process belong to a dev run of this repo?

    Port 3000 is not ours by right. A holder is killed only when it names the
    repo: the shell runs from node_modules\electron, and `npm run dev:web` runs
    node against vite's bin under the repo. The dev runner is the one that names
    neither - npm invokes it as a bare `node dev-runner.js` - so its own script
    name stands in for the path.
    #>
    param([int]$ProcessId)

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $false }

    foreach ($text in @($process.ExecutablePath, $process.CommandLine)) {
        if ([string]::IsNullOrEmpty($text)) { continue }
        if ($text.IndexOf($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
        if ($text.IndexOf('dev-runner.js', [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
    }
    return $false
}

function Stop-StaleShell {
    <# Kill Electron shells left behind by an earlier run of this repo.

    A shell holds no port, so freeing 3000 never reaches it: it sits there
    rendering a page nothing rebuilds. Only node_modules\electron counts, so a
    packaged Crate the operator is actually using survives this.
    #>
    $shells = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            -not [string]::IsNullOrEmpty($_.ExecutablePath) -and
            $_.ExecutablePath.StartsWith($ElectronBin, [System.StringComparison]::OrdinalIgnoreCase)
        })

    # One shell is four processes - the main one plus its renderer, GPU and
    # utility children, all running the same executable. Stop-Tree takes the
    # children with the main process, so only a process whose parent is not
    # itself a shell is worth naming: otherwise one stale app reports as four.
    $ids = @($shells | ForEach-Object { [int]$_.ProcessId })
    foreach ($shell in @($shells | Where-Object { $ids -notcontains [int]$_.ParentProcessId })) {
        Write-Host "    stopping a stale shell (pid $($shell.ProcessId))" -ForegroundColor Yellow
        Stop-Tree -ProcessId ([int]$shell.ProcessId)
    }
}

function Clear-Port {
    <# Free the dev port, so a previous run cannot poison this one. #>
    param(
        [int]$Port,
        [switch]$AllowForeign,
        [switch]$BestEffort
    )

    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { return }

    foreach ($processId in ($listeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $name = 'a dead owner'
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -ne $process) { $name = $process.ProcessName }

        if (-not (Test-OurProcess -ProcessId $processId) -and -not $AllowForeign) {
            $foreign = "port $Port is held by $name (pid $processId), which does not belong to this repo. Stop it yourself, or re-run with -Force to kill it."
            if ($BestEffort) {
                Write-Warning $foreign
                return
            }
            throw $foreign
        }

        Write-Host "    freeing port $Port from $name (pid $processId)" -ForegroundColor Yellow
        Stop-Tree -ProcessId $processId
    }

    # the socket takes a moment to leave LISTEN after its holder dies
    for ($i = 0; $i -lt 30; $i++) {
        $still = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        if ($still.Count -eq 0) { return }
        Start-Sleep -Milliseconds 200
    }

    $stuck = "port $Port is still held after being cleared. Find the holder with: Get-NetTCPConnection -LocalPort $Port -State Listen"
    if ($BestEffort) {
        Write-Warning $stuck
        return
    }
    # carrying on here is the bug this script exists to prevent: Vite would move
    # to 3001 and the new shell would load that, leaving the stale pair running
    throw $stuck
}

function Test-Prerequisites {
    if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
        throw "no node_modules in $RepoRoot. Run: npm install"
    }
    if (-not (Test-Path $ElectronBin)) {
        throw "no Electron in node_modules. Run: npm install"
    }
}

try {
    Test-Prerequisites

    Write-Step 'Clearing what an earlier run left behind'
    Stop-StaleShell
    Clear-Port -Port $RendererPort -AllowForeign:$Force

    Push-Location $RepoRoot
    try {
        if ($WebOnly) {
            Write-Step "Starting the renderer alone on :$RendererPort"
            Write-Host "    http://localhost:$RendererPort - no desktop bridge in a browser" -ForegroundColor DarkGray
            npm run dev:web
        }
        else {
            # dev-runner.js compiles the main process before it serves anything
            Write-Step "Starting the renderer on :$RendererPort and the Electron shell"
            Write-Host '    Ctrl+C here stops everything this script started' -ForegroundColor DarkGray
            npm run dev
        }
    }
    finally { Pop-Location }
}
finally {
    Write-Step 'Shutting down'
    # npm run dev leaves the Vite server and the shell behind on Windows
    Stop-StaleShell
    Clear-Port -Port $RendererPort -AllowForeign:$Force -BestEffort
}
