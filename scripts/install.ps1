#Requires -Version 5.1
param(
    [string]$PrepareVault = "",
    [string]$Agent = ""
)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $Root

$PathMarker = "# agentic-os-path"
$CodingAgent = ""
$script:ObsidianVaultManual = $false

try { Clear-Host } catch {}

if (-not $PrepareVault) {
    Get-Content (Join-Path $ScriptDir "install-banner.txt")
    Write-Host ""
}

function Log($msg) { Write-Host "  $msg" }
function Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Die($msg) { Warn $msg; exit 1 }

function Ensure-PathNow {
    $localBin = Join-Path $env:USERPROFILE ".local\bin"
    $bunBin = Join-Path $env:USERPROFILE ".bun\bin"
    $env:Path = "$localBin;$bunBin;$env:Path"
}

Ensure-PathNow

function Refresh-UserPath {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user;$env:Path"
    Ensure-PathNow
}

function Test-Toolchain {
    if (Get-Command cc -ErrorAction SilentlyContinue) {
        Log "C toolchain found"
        return
    }
    if (Get-Command cl -ErrorAction SilentlyContinue) {
        Log "C toolchain found"
        return
    }
    Warn "A C toolchain is required for better-sqlite3. Install Visual Studio Build Tools with the Desktop C++ workload."
}

function Install-NodeApp {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return $false }
    try {
        winget install --exact --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Refresh-UserPath
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Test-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Log "Node.js 20+ is required. Installing..."
        if (-not (Install-NodeApp) -or -not (Get-Command node -ErrorAction SilentlyContinue)) {
            Die "Node.js 20+ is required. Install: winget install OpenJS.NodeJS.LTS"
        }
    }
    $ver = (node -p "process.versions.node")
    $major = [int]($ver.Split(".")[0])
    if ($major -lt 20) { Die "Node.js 20+ required (found $ver)" }
    Log "Node.js $ver"
}

function Install-Bun {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        Log "Bun $(bun --version)"
        return
    }
    Log "Installing Bun..."
    irm https://bun.sh/install.ps1 | iex
    Ensure-PathNow
    if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { Die "Bun install failed" }
    Log "Bun $(bun --version)"
}

function Install-Uv {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        Log "uv installed"
        return
    }
    Log "Installing uv..."
    irm https://astral.sh/uv/install.ps1 | iex
    Ensure-PathNow
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Die "uv install failed" }
    Log "uv installed"
}

function Test-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Log (git --version)
        return
    }
    Log "Installing Git..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install --exact --id Git.Git --accept-package-agreements --accept-source-agreements
            Refresh-UserPath
        } catch {}
    }
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Log (git --version)
    } else {
        Warn "Git not found - git hooks will be skipped"
    }
}

function Test-CursorInstalled {
    if (Get-Command cursor -ErrorAction SilentlyContinue) { return $true }
    $paths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\cursor\Cursor.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Cursor\Cursor.exe"),
        (Join-Path $env:ProgramFiles "Cursor\Cursor.exe")
    )
    foreach ($p in $paths) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $true }
    }
    return $false
}

function Test-ClaudeInstalled {
    if (Get-Command claude -ErrorAction SilentlyContinue) { return $true }
    $paths = @(
        (Join-Path $env:USERPROFILE ".local\bin\claude.exe"),
        (Join-Path $env:USERPROFILE ".local\bin\claude"),
        (Join-Path $env:USERPROFILE ".claude\local\claude.exe"),
        (Join-Path $env:USERPROFILE ".claude\local\claude")
    )
    foreach ($p in $paths) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $true }
    }
    return $false
}

function Install-CursorApp {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return $false }
    try {
        winget install --exact --id Anysphere.Cursor --accept-package-agreements --accept-source-agreements
        Refresh-UserPath
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Install-ClaudeApp {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install --exact --id Anthropic.ClaudeCode --accept-package-agreements --accept-source-agreements
            Refresh-UserPath
            if ($LASTEXITCODE -eq 0) { return $true }
        } catch {}
    }
    try {
        irm https://claude.ai/install.ps1 | iex
        Refresh-UserPath
        return (Test-ClaudeInstalled)
    } catch {
        return $false
    }
}

function Normalize-Agent([string]$raw) {
    if (-not $raw) { return "" }
    $v = ($raw.Trim().ToLower() -replace '\s', '')
    if (@("1", "c", "cursor") -contains $v) { return "cursor" }
    if (@("2", "a", "claude", "claudecode", "claude-code", "anthropic") -contains $v) { return "claude" }
    return ""
}

function Get-CodingAgent {
    $raw = $Agent
    if (-not $raw) { $raw = $env:AGENTIC_AGENT }
    if ($raw) {
        $script:CodingAgent = Normalize-Agent $raw
        if (-not $script:CodingAgent) { Die "AGENTIC_AGENT must be cursor or claude" }
        Log "Coding agent: $($script:CodingAgent)"
        return
    }
    if ([Console]::IsInputRedirected) {
        Warn "Set AGENTIC_AGENT=cursor or AGENTIC_AGENT=claude (non-interactive)"
        return
    }
    Write-Host ""
    Log "Which coding agent do you use?"
    Log "  1) Cursor"
    Log "  2) Claude Code"
    while (-not $script:CodingAgent) {
        $choice = Read-Host "  [1/2]"
        $script:CodingAgent = Normalize-Agent $choice
        if (-not $script:CodingAgent) {
            Warn "Choose 1 (Cursor) or 2 (Claude Code)"
        }
    }
    Log "Coding agent: $($script:CodingAgent)"
}

function Ensure-OneAgent($name, $present, $install, $url) {
    if (& $present) {
        Log "$name is already installed"
        return
    }
    if ([Console]::IsInputRedirected) {
        Warn "$name not found (non-interactive). Install from $url"
        return
    }
    Log "Installing $name..."
    if ((& $install) -and (& $present)) {
        Log "$name installed"
        return
    }
    Log "Install $name from $url"
    try { Start-Process $url } catch {}
    Read-Host "  Press Enter when $name is installed (or continue without it)" | Out-Null
    if (& $present) {
        Log "$name is installed"
    } else {
        Warn "$name not detected - skills will still be copied"
    }
}

function Ensure-Agents {
    Get-CodingAgent
    if ($script:CodingAgent -eq "cursor") {
        Ensure-OneAgent "Cursor" { Test-CursorInstalled } { Install-CursorApp } "https://cursor.com/download"
    } elseif ($script:CodingAgent -eq "claude") {
        Ensure-OneAgent "Claude Code" { Test-ClaudeInstalled } { Install-ClaudeApp } "https://code.claude.com/docs/en/overview"
    }
}

function Guess-ProjectsRoot {
    if ($env:AGENTIC_CODE_ROOT) {
        return ($env:AGENTIC_CODE_ROOT -replace "^~", $env:USERPROFILE)
    }
    foreach ($name in @("Projects", "Developer", "dev", "src", "code")) {
        $p = Join-Path $env:USERPROFILE $name
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Get-CodeRoot {
    Log "Projects root is the folder that contains your git repos - not this Agentic OS clone."
    if ($env:AGENTIC_CODE_ROOT) {
        $expanded = $env:AGENTIC_CODE_ROOT -replace "^~", $env:USERPROFILE
        if (-not (Test-Path $expanded)) {
            $create = Read-Host "  Directory does not exist. Create it? [Y/n]"
            if (-not $create -or $create -match "^[Yy]") {
                New-Item -ItemType Directory -Path $expanded -Force | Out-Null
            } else {
                Die "Projects directory must exist: $expanded"
            }
        }
        $resolved = (Resolve-Path $expanded).Path
        Log "Projects root: $resolved (AGENTIC_CODE_ROOT)"
        return $resolved
    }
    $guessed = Guess-ProjectsRoot
    if ($guessed) {
        $input = Read-Host "  Where are your local projects? [$guessed]"
        if ([string]::IsNullOrWhiteSpace($input)) { $input = $guessed }
    } else {
        $input = Read-Host "  Where are your local projects?"
        if ([string]::IsNullOrWhiteSpace($input)) { Die "Projects directory is required" }
    }
    $expanded = $input -replace "^~", $env:USERPROFILE
    if (-not (Test-Path $expanded)) {
        $create = Read-Host "  Directory does not exist. Create it? [Y/n]"
        if (-not $create -or $create -match "^[Yy]") {
            New-Item -ItemType Directory -Path $expanded -Force | Out-Null
        } else {
            Die "Projects directory must exist: $expanded"
        }
    }
    return (Resolve-Path $expanded).Path
}

function Get-DefaultBrainRoot {
    if ($env:AGENTIC_BRAIN_DIR) {
        return ($env:AGENTIC_BRAIN_DIR -replace "^~", $env:USERPROFILE)
    }
    return (Join-Path $env:USERPROFILE "SecondBrain\Second Brain")
}

function Create-ObsidianVault($vault) {
    if (-not $vault) { Die "Vault path is required" }
    if ($script:ObsidianVaultManual -or $env:OBSIDIAN_VAULT_MANUAL -eq "1") { return }
    New-Item -ItemType Directory -Path (Join-Path $vault ".obsidian") -Force | Out-Null
}

function Test-ObsidianInstalled {
    if (Get-Command obsidian -ErrorAction SilentlyContinue) { return $true }
    $paths = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Obsidian\Obsidian.exe"),
        (Join-Path $env:ProgramFiles "Obsidian\Obsidian.exe")
    )
    if (${env:ProgramFiles(x86)}) {
        $paths += (Join-Path ${env:ProgramFiles(x86)} "Obsidian\Obsidian.exe")
    }
    foreach ($p in $paths) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $true }
    }
    return $false
}

function Install-ObsidianApp {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return $false }
    try {
        winget install --exact --id Obsidian.Obsidian --accept-package-agreements --accept-source-agreements
        Refresh-UserPath
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Show-ObsidianHowto {
    $location = Join-Path $env:USERPROFILE "SecondBrain"
    $script:ObsidianVaultManual = $true
    Write-Host ""
    Log "Install Obsidian from https://obsidian.md/download"
    Log "Create a vault (a folder of markdown files):"
    Log "  1. Open Obsidian"
    Log "  2. Create new vault"
    Log "     Name: Second Brain"
    Log "     Location: $location"
    Log "  Or: vault icon -> Manage vaults... -> Open folder as vault"
}

function Open-ObsidianDownload {
    try { Start-Process "https://obsidian.md/download" } catch {}
}

function Ensure-Obsidian {
    Write-Host ""
    Log "Obsidian is the app that opens your Second Brain vault."
    if (Test-ObsidianInstalled) {
        Log "Obsidian is already installed"
        return
    }
    if ([Console]::IsInputRedirected) {
        if ((Install-ObsidianApp) -and (Test-ObsidianInstalled)) {
            Log "Obsidian installed"
            return
        }
        Warn "Obsidian not found (non-interactive). Install from https://obsidian.md/download"
        return
    }
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Log "Installing Obsidian..."
        if ((Install-ObsidianApp) -and (Test-ObsidianInstalled)) {
            Log "Obsidian installed"
            return
        }
        Warn "Obsidian install did not finish - follow the steps below"
    }
    Show-ObsidianHowto
    Open-ObsidianDownload
    Read-Host "  Press Enter when Obsidian is installed and the vault is created (or continue without it)" | Out-Null
    if (Test-ObsidianInstalled) {
        Log "Obsidian is installed"
    } else {
        Warn "Obsidian not detected - the vault folder will still work as markdown"
    }
}

function Prepare-BrainVault {
    $vault = Get-DefaultBrainRoot
    Write-Host ""
    if ($script:ObsidianVaultManual -or $env:OBSIDIAN_VAULT_MANUAL -eq "1") {
        Log "You were asked to create the vault in Obsidian. Not creating one automatically."
        Log "  Suggested path: $vault"
        return
    }
    Log "A vault is a folder Obsidian opens. Preparing:"
    Log "  $vault"
    Create-ObsidianVault $vault
    Log "Vault folder ready."
    Log "In Obsidian: vault icon -> Manage vaults... -> Open folder as vault"
    Log "  and choose that folder if it is not already listed."
}

function Get-BrainRoot {
    if ($env:AGENTIC_BRAIN_DIR) {
        $expanded = $env:AGENTIC_BRAIN_DIR -replace "^~", $env:USERPROFILE
        if (-not (Test-Path $expanded)) {
            $create = Read-Host "  Directory does not exist. Create it? [Y/n]"
            if (-not $create -or $create -match "^[Yy]") {
                New-Item -ItemType Directory -Path $expanded -Force | Out-Null
            } else {
                Die "Vault directory must exist: $expanded"
            }
        }
        Create-ObsidianVault $expanded
        $resolved = (Resolve-Path $expanded).Path
        Log "Vault: $resolved (AGENTIC_BRAIN_DIR)"
        return $resolved
    }
    $default = Get-DefaultBrainRoot
    $input = Read-Host "  Where is your Second Brain vault? [$default]"
    if ([string]::IsNullOrWhiteSpace($input)) { $input = $default }
    $expanded = $input -replace "^~", $env:USERPROFILE
    if (-not (Test-Path $expanded)) {
        $create = Read-Host "  Directory does not exist. Create it? [Y/n]"
        if (-not $create -or $create -match "^[Yy]") {
            New-Item -ItemType Directory -Path $expanded -Force | Out-Null
        } else {
            Die "Vault directory must exist: $expanded"
        }
    }
    Create-ObsidianVault $expanded
    return (Resolve-Path $expanded).Path
}

function Seed-BrainAndSkills($vault) {
    Log "Seeding Second Brain vault and syncing Cursor and Claude Code skills..."
    $bootstrap = Join-Path $Root "scripts\install-bootstrap.mjs"
    node $bootstrap --vault $vault
    if ($LASTEXITCODE -ne 0) { Die "Vault and skills bootstrap failed" }
}

function Open-ObsidianVault($vault) {
    if (-not (Test-ObsidianInstalled)) { return }
    $encoded = [uri]::EscapeDataString($vault)
    $uri = "obsidian://open?path=$encoded"
    try { Start-Process $uri } catch {
        try { Start-Process "Obsidian" $vault } catch {}
    }
    Log "Opened vault in Obsidian (Manage vaults -> Open folder as vault if it did not appear)"
}

function Update-GraphifyRepo {
    Write-Host ""
    Log "Building the Graphify graph for this Agentic OS clone..."
    if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
        Warn "graphify not on PATH - run graphify update . later from this repo"
        return
    }
    graphify update .
    if ($LASTEXITCODE -eq 0) {
        Log "Graphify graph ready"
    } else {
        Warn "graphify update failed - run it later from this repo"
    }
}

function Write-AgenticConfig($codeRoot, $brainRoot) {
    $configPath = Join-Path $Root "store\agentic.config.json"
    New-Item -ItemType Directory -Path (Split-Path $configPath) -Force | Out-Null
    $graphifyVer = $null
    if (Get-Command graphify -ErrorAction SilentlyContinue) {
        $graphifyVer = (graphify --version 2>$null)
    }
    $next = [ordered]@{}
    if (Test-Path $configPath) {
        try {
            $existing = Get-Content $configPath -Raw | ConvertFrom-Json
            foreach ($prop in $existing.PSObject.Properties) {
                $next[$prop.Name] = $prop.Value
            }
        } catch {}
    }
    $next.codeRoot = $codeRoot
    $next.brainRoot = $brainRoot
    $next.installedAt = (Get-Date).ToUniversalTime().ToString("o")
    if ($graphifyVer) {
        $next.graphifyVersion = $graphifyVer
    } elseif (-not $next.Contains("graphifyVersion")) {
        $next.graphifyVersion = $null
    }
    ($next | ConvertTo-Json) | Set-Content $configPath -Encoding UTF8
}

function Persist-Path {
    $localBin = Join-Path $env:USERPROFILE ".local\bin"
    $bunBin = Join-Path $env:USERPROFILE ".bun\bin"
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $toAdd = @($localBin, $bunBin) | Where-Object { $userPath -notlike "*$_*" }
    if ($toAdd.Count -gt 0) {
        $newPath = ($toAdd + $userPath) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Log "Added tool paths to User PATH"
    } else {
        Log "User PATH already includes tool directories"
    }
    $profileDir = Split-Path $PROFILE -Parent
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
    if (-not (Test-Path $PROFILE)) {
        @"
# PowerShell profile - created by Agentic OS installer
# Adds ~/.local/bin and ~/.bun/bin to PATH for graphify and bun

"@ | Set-Content $PROFILE -Encoding UTF8
        Log "Created PowerShell profile (did not exist): $PROFILE"
    }
    $profileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($profileContent -and $profileContent.Contains($PathMarker)) {
        Log "PowerShell profile already has Agentic OS PATH marker"
        return
    }
    Add-Content $PROFILE @"

$PathMarker
`$env:Path = "`$env:USERPROFILE\.local\bin;`$env:USERPROFILE\.bun\bin;`$env:Path"
"@
    Log "Updated PowerShell profile: $PROFILE"
}

function Install-JsDeps {
    Log "Installing JavaScript dependencies..."
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
    } else {
        npm install
    }
}

function Install-Graphify {
    Log "Installing Graphify..."
    uv tool install --upgrade graphifyy
    Ensure-PathNow
    if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) { Die "graphify not found after uv tool install" }
    if ($script:CodingAgent -eq "claude") {
        graphify install --platform claude
        graphify install --project --platform claude
    } elseif ($script:CodingAgent -eq "cursor") {
        graphify install --platform cursor
        graphify install --project --platform cursor
    } else {
        graphify install --platform cursor
        graphify install --platform claude
        graphify install --project --platform cursor
        graphify install --project --platform claude
    }
    Log "Graphify $(graphify --version)"
}

function Bootstrap-Store {
    New-Item -ItemType Directory -Path (Join-Path $Root "store\projects") -Force | Out-Null
    $tokenPath = Join-Path $Root "store\.dashboard-token"
    if (-not (Test-Path $tokenPath)) {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        [BitConverter]::ToString($bytes).Replace("-", "").ToLower() | Set-Content $tokenPath -NoNewline
    }
}

function Invoke-TelegramCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CliArgs)
    $tsx = Join-Path $Root "node_modules\.bin\tsx.cmd"
    if (-not (Test-Path $tsx)) { $tsx = Join-Path $Root "node_modules\.bin\tsx" }
    if (-not (Test-Path $tsx)) { $tsx = Join-Path $Root "packages\server\node_modules\.bin\tsx.cmd" }
    if (-not (Test-Path $tsx)) { Die "tsx not found - JavaScript dependencies must be installed first" }
    $setup = Join-Path $Root "packages\server\src\cli\telegram-setup.ts"
    & $tsx $setup @CliArgs
    if ($LASTEXITCODE -ne 0) { throw "telegram-setup $($CliArgs[0]) failed" }
}

function Save-Telegram($token, $chatId) {
    $env:AGENTIC_TELEGRAM_BOT_TOKEN = $token
    $env:AGENTIC_TELEGRAM_CHAT_ID = $chatId
    try {
        Invoke-TelegramCli save
    } finally {
        Remove-Item Env:AGENTIC_TELEGRAM_BOT_TOKEN -ErrorAction SilentlyContinue
        Remove-Item Env:AGENTIC_TELEGRAM_CHAT_ID -ErrorAction SilentlyContinue
    }
}

function ConvertFrom-SecureStringPlain([Security.SecureString]$secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Prompt-Telegram {
    Write-Host ""
    Log "Telegram delivery"
    if ($env:TELEGRAM_BOT_TOKEN -and $env:TELEGRAM_CHAT_ID) {
        Save-Telegram $env:TELEGRAM_BOT_TOKEN $env:TELEGRAM_CHAT_ID
        Log "Telegram connection saved from environment"
        return
    }
    if ([Console]::IsInputRedirected) {
        Log "Telegram skipped (non-interactive). Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or use the dashboard Routines panel."
        return
    }
    Invoke-TelegramCli howto
    Write-Host ""
    $status = (Invoke-TelegramCli status | Out-String).Trim()
    if ($status -like "connected*") {
        Log "Already $status"
        $replace = Read-Host "  Replace Telegram connection? [y/N]"
        if (-not $replace -or $replace -notmatch "^[Yy]") {
            Log "Keeping existing Telegram connection"
            return
        }
    } else {
        $reply = Read-Host "  Set up Telegram now? [y/N]"
        if ($reply -notmatch "^[Yy]") {
            Log "Telegram skipped - set it up later in the dashboard Routines panel"
            return
        }
    }
    $secure = Read-Host "  Bot token" -AsSecureString
    $token = (ConvertFrom-SecureStringPlain $secure).Trim()
    $chatId = (Read-Host "  Chat id").Trim()
    if (-not $token -or -not $chatId) {
        Warn "Bot token and chat id are required - skipping Telegram. Use the dashboard Routines panel later."
        return
    }
    Save-Telegram $token $chatId
    Log "Telegram connection saved ($(Invoke-TelegramCli status))"
}

function Write-GraphifyPython {
    $graphifyOut = Join-Path $Root "graphify-out"
    New-Item -ItemType Directory -Path $graphifyOut -Force | Out-Null
    $python = $null
    try {
        $python = (uv tool run graphifyy python -c "import sys; print(sys.executable)" 2>$null)
    } catch {}
    if (-not $python) { $python = "python" }
    try {
        & $python -c "import sys; open(r'$graphifyOut\.graphify_python', 'w', encoding='utf-8').write(sys.executable)"
    } catch {}
}

function Augment-CursorRule {
    $rule = Join-Path $Root ".cursor\rules\graphify.mdc"
    if (-not (Test-Path $rule)) { return }
    $content = Get-Content $rule -Raw
    if ($content -match "agentic-os-graphify-path") { return }
    Add-Content $rule @"

<!-- agentic-os-graphify-path -->
Before any graphify command, ensure PATH includes ~/.local/bin:
export PATH="`$HOME/.local/bin:`$PATH"
"@
}

function Print-Success($codeRoot, $brainRoot) {
    $telegramStatus = "skipped"
    try { $telegramStatus = (Invoke-TelegramCli status | Out-String).Trim() } catch {}
    Write-Host ""
    Write-Host "---------------------------------------------------------"
    Write-Host "  Agentic OS is ready."
    Write-Host " ---------------------------------------------------------"
    Write-Host ""
    Write-Host "  Dashboard:  http://localhost:5173"
    Write-Host "  API:        http://127.0.0.1:3847"
    Write-Host "  Token:      store/.dashboard-token"
    Write-Host "  Telegram:   $telegramStatus"
    Write-Host "  Projects:   $codeRoot"
    Write-Host "  Vault:      $brainRoot"
    Write-Host "  Skills:     $env:USERPROFILE\.cursor\skills"
    Write-Host "              $env:USERPROFILE\.claude\skills"
    Write-Host ""
    Write-Host "  1. bun run dev"
    if ($script:CodingAgent -eq "claude") {
        Write-Host "  2. Run: claude   (in this folder)"
    } else {
        Write-Host "  2. Open this repo in Cursor and fully restart Cursor so skills load."
    }
    Write-Host "  3. Paste the dashboard token when the UI asks."
    Write-Host "  4. Add git repos under Projects in the dashboard."
    Write-Host ""
}

function Test-Health {
    Ensure-PathNow
    if (Get-Command graphify -ErrorAction SilentlyContinue) {
        Log "graphify: $(graphify --version 2>$null)"
    } else {
        if ($script:CodingAgent -eq "claude") {
            Warn "graphify not on PATH - open a new terminal or start a new claude session"
        } else {
            Warn "graphify not on PATH - open a new terminal or restart Cursor"
        }
    }
}

if ($PrepareVault) {
    $vault = $PrepareVault -replace "^~", $env:USERPROFILE
    if ($env:OBSIDIAN_VAULT_MANUAL -eq "1") {
        $script:ObsidianVaultManual = $true
    }
    Create-ObsidianVault $vault
    if ($script:ObsidianVaultManual) {
        Log "VAULT_SKIPPED"
        exit 0
    }
    $resolved = (Resolve-Path $vault).Path
    Log "VAULT_READY $resolved"
    exit 0
}

Log "Detecting environment (Windows)..."
Test-Toolchain
Test-Git
Test-NodeVersion
Install-Bun
Install-Uv
Ensure-Agents
$codeRoot = Get-CodeRoot
Ensure-Obsidian
Prepare-BrainVault
$brainRoot = Get-BrainRoot
Seed-BrainAndSkills $brainRoot
Install-JsDeps
Install-Graphify
Persist-Path
Write-AgenticConfig $codeRoot $brainRoot
Bootstrap-Store
Update-GraphifyRepo
Prompt-Telegram
Write-GraphifyPython
Augment-CursorRule
Open-ObsidianVault $brainRoot
Test-Health
Print-Success $codeRoot $brainRoot
