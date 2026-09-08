<#
.SYNOPSIS
    Start the Crate renderer alone in a browser, without the Electron shell.

.DESCRIPTION
    The same startup dev.ps1 performs, minus the shell: the port is freed first
    and swept again on the way out. Use it when you are working on the UI in a
    browser. The desktop bridge is absent there, so the renderer's
    `window.crateBridge` guards fall back and anything behind them - the
    library scan, tag writes, USB sync - is unavailable.

.PARAMETER Force
    Free the dev port even when its holder cannot be attributed to this repo.

.EXAMPLE
    .\scripts\web.ps1
#>
[CmdletBinding()]
param(
    [switch]$Force
)

# One startup path, one place to fix it.
& (Join-Path $PSScriptRoot 'dev.ps1') -WebOnly -Force:$Force
