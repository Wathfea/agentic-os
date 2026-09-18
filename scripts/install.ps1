#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $Root

$PathMarker = "# agentic-os-path"

try { Clear-Host } catch {}

Get-Content (Join-Path $ScriptDir "install-banner.txt")
Write-Host ""

function Log($msg) { Write-Host "  $msg" }
function Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Die($msg) { Warn $msg; exit 1 }

function Ensure-PathNow {
    $localBin = Join-Path $env:USERPROFILE ".local\bin"
    $bunBin = Join-Path $env:USERPROFILE ".bun\bin"
    $env:Path = "$localBin;$bunBin;$env:Path"
}

Ensure-PathNow

function Test-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Die "Node.js 20+ is required. Install: winget install OpenJS.NodeJS.LTS"
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
    $reply = Read-Host "  Bun not found. Install now? [Y/n]"
    if ($reply -and $reply -notmatch "^[Yy]") { Die "Bun is required for Agentic OS" }
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
    $reply = Read-Host "  uv not found. Install now? [Y/n]"
    if ($reply -and $reply -notmatch "^[Yy]") { Die "uv is required for Graphify" }
    irm https://astral.sh/uv/install.ps1 | iex
    Ensure-PathNow
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Die "uv install failed" }
    Log "uv installed"
}

function Test-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Log (git --version)
    } else {
        Warn "Git not found - git hooks will be skipped"
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
        $resolved = (Resolve-Path $expanded).Path
        Log "Vault: $resolved (AGENTIC_BRAIN_DIR)"
        return $resolved
    }
    $default = Join-Path $env:USERPROFILE "SecondBrain\Second Brain"
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
    return (Resolve-Path $expanded).Path
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
    graphify install
    graphify cursor install --project
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
        $reply = Read-Host "  Set up Telegram now? [Y/n]"
        if ($reply -and $reply -notmatch "^[Yy]") {
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
    Write-Host ""
    Write-Host "  Start:      bun run dev"
    Write-Host "  Restart Cursor so agents can run graphify query."
    Write-Host ""
}

function Test-Health {
    Ensure-PathNow
    if (Get-Command graphify -ErrorAction SilentlyContinue) {
        Log "graphify: $(graphify --version 2>$null)"
    } else {
        Warn "graphify not on PATH - open a new terminal or restart Cursor"
    }
}

Log "Detecting environment (Windows)..."
Test-NodeVersion
Install-Bun
Install-Uv
Test-Git
$codeRoot = Get-CodeRoot
$brainRoot = Get-BrainRoot
Install-JsDeps
Install-Graphify
Persist-Path
Write-AgenticConfig $codeRoot $brainRoot
Bootstrap-Store
Prompt-Telegram
Write-GraphifyPython
Augment-CursorRule
Test-Health
Print-Success $codeRoot $brainRoot
