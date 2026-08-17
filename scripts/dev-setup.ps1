<#
.SYNOPSIS
    Provisions Charva Travel's local development services without Docker.

.DESCRIPTION
    The development machine has no Docker and no administrator rights, so the services from
    docker/docker-compose.dev.yml are installed as portable binaries under .services/:

        MySQL    8.0.42   127.0.0.1:3308   (XAMPP's MariaDB keeps 3306, silkgrain keeps 3307)
        Mailpit  latest   SMTP 1026, web UI http://localhost:8026
        ffmpeg   release  no port - a binary used by the media pipeline

    Everything lives inside the repository under .services/ (gitignored) and nothing is
    written to the registry, PATH or Program Files. Delete .services/ to start over.

    There is deliberately no Redis and no MinIO. Caching and rate limiting live in the API
    process (decision D-7) and media lives on local disk (decision D-8).

.PARAMETER Action
    install  Download, unpack and initialise everything, then start it. Safe to re-run.
    start    Start services that are installed but not running.
    stop     Stop services started by this script.
    status   Report what is installed and what is listening.
    remove   Stop everything and delete .services/.

.PARAMETER Only
    Restrict the action to a subset: mysql, mailpit, ffmpeg.

.EXAMPLE
    pnpm setup:services
.EXAMPLE
    powershell -File scripts/dev-setup.ps1 -Action status
.EXAMPLE
    powershell -File scripts/dev-setup.ps1 -Action start -Only mysql

.NOTES
    Keep this file pure ASCII. Windows PowerShell 5.1 reads BOM-less files as ANSI, so a
    UTF-8 dash or quote turns into bytes it parses as string delimiters and the script fails
    with confusing syntax errors far from the offending line. Phase 0 acceptance checks this:
        [IO.File]::ReadAllBytes('scripts/dev-setup.ps1') | Where-Object { $_ -gt 127 }
    must return nothing.
#>
[CmdletBinding()]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute(
    'PSAvoidUsingPlainTextForPassword', 'MysqlRootPassword',
    Justification = 'Local-only credential for a MySQL bound to 127.0.0.1 that holds nothing
    but development seed data. It has to reach mysql.exe as plain text on the command line
    anyway, and it is deliberately not the password of any other server on this machine, so
    committing it alongside .env.example leaks nothing. A SecureString here would add
    ceremony and no security.')]
param(
    [ValidateSet('install', 'start', 'stop', 'status', 'remove')]
    [string]$Action = 'install',

    [ValidateSet('mysql', 'mailpit', 'ffmpeg')]
    [string[]]$Only,

    # Local-only credential for the portable MySQL on 127.0.0.1:3308. Deliberately not the
    # password of any other server on this machine, so committing .env.example leaks nothing.
    [string]$MysqlRootPassword = 'charva_dev_only'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --------------------------------------------------------------------------------------
# Paths, versions and sources
# --------------------------------------------------------------------------------------

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ServicesDir = Join-Path $RepoRoot '.services'
$DownloadDir = Join-Path $ServicesDir '_downloads'
$RunDir = Join-Path $ServicesDir '_run'

$MysqlVersion = '8.0.42'

$Sources = @{
    mysql   = "https://cdn.mysql.com/archives/mysql-8.0/mysql-$MysqlVersion-winx64.zip"
    mailpit = 'https://github.com/axllent/mailpit/releases/latest/download/mailpit-windows-amd64.zip'
    ffmpeg  = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
}

# Ports must match docker/docker-compose.dev.yml exactly.
$Ports = @{ mysql = 3308; mailpit = 1026 }
$MailpitUiPort = 8026

$AllServices = @('mysql', 'mailpit', 'ffmpeg')
$Selected = if ($Only) { $Only } else { $AllServices }

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------

function Write-Step { param([string]$Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok { param([string]$Message) Write-Host "    $Message" -ForegroundColor Green }
function Write-Note { param([string]$Message) Write-Host "    $Message" -ForegroundColor DarkGray }
function Write-Warn { param([string]$Message) Write-Host "    $Message" -ForegroundColor Yellow }

function Invoke-Native {
    <#
        Runs a native executable and returns its exit code plus combined output.

        Windows PowerShell 5.1 wraps every stderr line from a native command in an
        ErrorRecord. With $ErrorActionPreference = 'Stop' that aborts the script even when
        the program succeeded - and mysqld writes its normal progress to stderr. So the
        preference is relaxed for the duration of the call and success is judged by the
        exit code, which is the only reliable signal here.
    #>
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$AllowFailure
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $FilePath @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }
    if (-not $AllowFailure -and $code -ne 0) {
        $name = Split-Path $FilePath -Leaf
        throw "$name exited with code $code`n$($output -join [Environment]::NewLine)"
    }
    return [pscustomobject]@{ ExitCode = $code; Output = $output }
}

function Test-PortOpen {
    param([int]$Port)
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $connect = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok = $connect.AsyncWaitHandle.WaitOne(400)
        if ($ok) { $client.EndConnect($connect) }
        $client.Close()
        return $ok
    }
    catch { return $false }
}

function Wait-ForPort {
    param([int]$Port, [int]$TimeoutSeconds = 60, [string]$Name = 'service')
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortOpen -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not start listening on port $Port within $TimeoutSeconds seconds."
}

function Get-Archive {
    param([string]$Url, [string]$Destination)
    if (Test-Path $Destination) {
        Write-Note "cached $(Split-Path $Destination -Leaf)"
        return
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
    Write-Note "downloading $Url"
    $temp = "$Destination.part"
    $previous = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'   # roughly 10x faster for large files
    try {
        Invoke-WebRequest -Uri $Url -OutFile $temp -UseBasicParsing -TimeoutSec 900
        Move-Item -LiteralPath $temp -Destination $Destination -Force
    }
    finally {
        $ProgressPreference = $previous
        if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
    }
    $sizeMb = [math]::Round((Get-Item $Destination).Length / 1MB, 1)
    Write-Ok "downloaded $(Split-Path $Destination -Leaf) ($sizeMb MB)"
}

function Expand-Once {
    param([string]$Archive, [string]$Target)
    if (Test-Path $Target) { return }
    $staging = "$Target.staging"
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    Expand-Archive -LiteralPath $Archive -DestinationPath $staging -Force
    # Collapse a single wrapper directory, so layouts are identical across archives.
    $entries = @(Get-ChildItem -LiteralPath $staging)
    if ($entries.Count -eq 1 -and $entries[0].PSIsContainer) {
        Move-Item -LiteralPath $entries[0].FullName -Destination $Target
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
    else {
        Move-Item -LiteralPath $staging -Destination $Target
    }
}

function Get-PidFile { param([string]$Name) Join-Path $RunDir "$Name.pid" }

function Get-RunningProcess {
    param([string]$Name)
    $pidFile = Get-PidFile $Name
    if (-not (Test-Path $pidFile)) { return $null }
    $processId = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
    return Get-Process -Id $processId -ErrorAction SilentlyContinue
}

function Start-DevService {
    # Named Start-DevService, not Start-Service: the latter is a built-in cmdlet and
    # shadowing it here would make this script confusing to read and to debug.
    param([string]$Name, [string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory)

    if (Get-RunningProcess $Name) { Write-Note "$Name already running"; return }

    # A service that was never installed is a note, not an exception. Start-Process throws
    # DirectoryNotFoundException on a missing WorkingDirectory, which used to abort the whole
    # -Action start - taking down the report of the services that had just started fine.
    if (-not (Test-Path -LiteralPath $FilePath)) {
        Write-Warn "$Name is not installed - run this script with -Action install"
        return
    }

    if (Test-PortOpen -Port $Ports[$Name]) {
        Write-Warn "port $($Ports[$Name]) is already in use - assuming an external $Name and leaving it alone"
        return
    }

    New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
    $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $RunDir "$Name.out.log") `
        -RedirectStandardError (Join-Path $RunDir "$Name.err.log")
    Set-Content -LiteralPath (Get-PidFile $Name) -Value $proc.Id -Encoding ascii
    Wait-ForPort -Port $Ports[$Name] -Name $Name | Out-Null
    Write-Ok "$Name listening on 127.0.0.1:$($Ports[$Name])"
}

function Stop-DevService {
    param([string]$Name)
    $proc = Get-RunningProcess $Name
    if (-not $proc) { Write-Note "$Name not running"; return }
    Stop-Process -Id $proc.Id -Force
    Remove-Item -LiteralPath (Get-PidFile $Name) -Force -ErrorAction SilentlyContinue
    Write-Ok "$Name stopped"
}

# --------------------------------------------------------------------------------------
# MySQL
# --------------------------------------------------------------------------------------

$MysqlHome = Join-Path $ServicesDir 'mysql'
$MysqlData = Join-Path $ServicesDir 'mysql-data'
$MysqlIni = Join-Path $ServicesDir 'my.ini'

function Install-Mysql {
    Write-Step "MySQL $MysqlVersion"
    $archive = Join-Path $DownloadDir "mysql-$MysqlVersion-winx64.zip"
    Get-Archive -Url $Sources.mysql -Destination $archive
    Expand-Once -Archive $archive -Target $MysqlHome

    if (-not (Test-Path $MysqlIni)) {
        # These settings mirror docker/docker-compose.dev.yml exactly, and the sql-mode string
        # must stay identical in both places. STRICT_TRANS_TABLES matters most: without it
        # MySQL silently truncates instead of rejecting bad data, so a bug that would fail in
        # production passes here. ONLY_FULL_GROUP_BY is stock MySQL 8 behaviour and is set for
        # the same reason - a grouped query must not pass locally and fail on the server.
        @"
[mysqld]
basedir=$($MysqlHome -replace '\\', '/')
datadir=$($MysqlData -replace '\\', '/')
port=$($Ports.mysql)
bind-address=127.0.0.1
sql-mode=ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone='+00:00'
max_connections=151
innodb_buffer_pool_size=256M

[client]
port=$($Ports.mysql)
host=127.0.0.1
default-character-set=utf8mb4
"@ | Set-Content -LiteralPath $MysqlIni -Encoding ascii
        Write-Ok 'wrote my.ini'
    }

    $mysqld = Join-Path $MysqlHome 'bin\mysqld.exe'
    if (-not (Test-Path $MysqlData)) {
        Write-Note 'initialising data directory (takes about 30 seconds)'
        Invoke-Native -FilePath $mysqld -Arguments @(
            "--defaults-file=$MysqlIni", '--initialize-insecure', '--console'
        ) | Out-Null
        if (-not (Test-Path $MysqlData)) { throw 'MySQL initialisation produced no data directory.' }
        Write-Ok 'data directory initialised'
    }

    Start-Mysql

    $mysqlCli = Join-Path $MysqlHome 'bin\mysql.exe'
    # --initialize-insecure leaves root without a password; set it, then create the schemas.
    $probe = Invoke-Native -FilePath $mysqlCli -AllowFailure -Arguments @(
        "--defaults-file=$MysqlIni", '-u', 'root', '--skip-password', '-e', 'SELECT 1'
    )
    if ($probe.ExitCode -eq 0) {
        Write-Note 'setting root password'
        Invoke-Native -FilePath $mysqlCli -Arguments @(
            "--defaults-file=$MysqlIni", '-u', 'root', '--skip-password',
            '-e', "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MysqlRootPassword'; FLUSH PRIVILEGES;"
        ) | Out-Null
        Write-Ok 'root password set'
    }
    else {
        Write-Note 'root password already set'
    }

    $create = 'CREATE DATABASE IF NOT EXISTS `charva` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;' +
    ' CREATE DATABASE IF NOT EXISTS `charva_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
    Invoke-Native -FilePath $mysqlCli -Arguments @(
        "--defaults-file=$MysqlIni", '-u', 'root', "-p$MysqlRootPassword", '-e', $create
    ) | Out-Null
    Write-Ok 'databases charva and charva_test ready'
}

function Start-Mysql {
    Start-DevService -Name 'mysql' -FilePath (Join-Path $MysqlHome 'bin\mysqld.exe') `
        -ArgumentList @("--defaults-file=$MysqlIni") -WorkingDirectory $MysqlHome
}

function Stop-Mysql {
    $proc = Get-RunningProcess 'mysql'
    if (-not $proc) { Write-Note 'mysql not running'; return }
    # Prefer a clean shutdown so InnoDB does not have to recover on the next start.
    $admin = Join-Path $MysqlHome 'bin\mysqladmin.exe'
    if (Test-Path $admin) {
        Invoke-Native -FilePath $admin -AllowFailure -Arguments @(
            "--defaults-file=$MysqlIni", '-u', 'root', "-p$MysqlRootPassword", 'shutdown'
        ) | Out-Null
        Start-Sleep -Seconds 2
    }
    Stop-DevService 'mysql'
}

# --------------------------------------------------------------------------------------
# Mailpit
# --------------------------------------------------------------------------------------

$MailpitHome = Join-Path $ServicesDir 'mailpit'

function Install-Mailpit {
    Write-Step 'Mailpit'
    $archive = Join-Path $DownloadDir 'mailpit-windows-amd64.zip'
    Get-Archive -Url $Sources.mailpit -Destination $archive
    if (-not (Test-Path $MailpitHome)) {
        Expand-Archive -LiteralPath $archive -DestinationPath $MailpitHome -Force
    }
    Start-Mailpit
}

function Start-Mailpit {
    # Ports 1026 and 8026, not the Mailpit defaults, so an instance from another project can
    # run at the same time. docker-compose.dev.yml maps the same pair.
    Start-DevService -Name 'mailpit' -FilePath (Join-Path $MailpitHome 'mailpit.exe') `
        -ArgumentList @(
        '--smtp', "127.0.0.1:$($Ports.mailpit)",
        '--listen', "127.0.0.1:$MailpitUiPort",
        '--max', '500'
    ) -WorkingDirectory $MailpitHome

    # Only where there is an inbox to open. Printing the address next to "not installed" is
    # the kind of line somebody follows for a minute before reading the one above it.
    if (Test-Path -LiteralPath (Join-Path $MailpitHome 'mailpit.exe')) {
        Write-Note "inbox at http://localhost:$MailpitUiPort"
    }
}

function Stop-Mailpit { Stop-DevService 'mailpit' }

# --------------------------------------------------------------------------------------
# ffmpeg
#
# Not a service - a pair of binaries the media pipeline shells out to. ffprobe reads the
# duration of an uploaded video, ffmpeg makes the poster frame and the 720p transcode.
# --------------------------------------------------------------------------------------

$FfmpegHome = Join-Path $ServicesDir 'ffmpeg'

function Install-Ffmpeg {
    Write-Step 'ffmpeg'
    $archive = Join-Path $DownloadDir 'ffmpeg-release-essentials.zip'
    Get-Archive -Url $Sources.ffmpeg -Destination $archive
    Expand-Once -Archive $archive -Target $FfmpegHome

    $ffmpeg = Join-Path $FfmpegHome 'bin\ffmpeg.exe'
    if (-not (Test-Path $ffmpeg)) { throw "ffmpeg.exe not found under $FfmpegHome after unpacking." }

    $version = (Invoke-Native -FilePath $ffmpeg -Arguments @('-version')).Output |
        Select-Object -First 1
    Write-Ok $version
    Write-Note 'Phase 7 adds FFMPEG_PATH and FFPROBE_PATH to .env pointing at .services/ffmpeg/bin'
}

# --------------------------------------------------------------------------------------
# Actions
# --------------------------------------------------------------------------------------

function Invoke-Install {
    New-Item -ItemType Directory -Force -Path $ServicesDir, $DownloadDir, $RunDir | Out-Null
    if ($Selected -contains 'mysql') { Install-Mysql }
    if ($Selected -contains 'mailpit') { Install-Mailpit }
    if ($Selected -contains 'ffmpeg') { Install-Ffmpeg }
    Write-Host ''
    Invoke-Status
}

function Invoke-Start {
    if ($Selected -contains 'mysql') { Write-Step 'MySQL'; Start-Mysql }
    if ($Selected -contains 'mailpit') { Write-Step 'Mailpit'; Start-Mailpit }
    if ($Selected -contains 'ffmpeg') { Write-Note 'ffmpeg is a binary, not a service - nothing to start' }
}

function Invoke-Stop {
    if ($Selected -contains 'mysql') { Write-Step 'MySQL'; Stop-Mysql }
    if ($Selected -contains 'mailpit') { Write-Step 'Mailpit'; Stop-Mailpit }
}

function Invoke-Status {
    Write-Step 'Status'

    $rows = @()
    $rows += [pscustomobject]@{
        Service   = 'mysql'
        Installed = if (Test-Path (Join-Path $MysqlHome 'bin\mysqld.exe')) { 'yes' } else { 'no' }
        Address   = "127.0.0.1:$($Ports.mysql)"
        Listening = if (Test-PortOpen -Port $Ports.mysql) { 'yes' } else { 'no' }
    }
    $rows += [pscustomobject]@{
        Service   = 'mailpit'
        Installed = if (Test-Path (Join-Path $MailpitHome 'mailpit.exe')) { 'yes' } else { 'no' }
        Address   = "smtp $($Ports.mailpit), ui $MailpitUiPort"
        Listening = if (Test-PortOpen -Port $Ports.mailpit) { 'yes' } else { 'no' }
    }
    $rows += [pscustomobject]@{
        Service   = 'ffmpeg'
        Installed = if (Test-Path (Join-Path $FfmpegHome 'bin\ffmpeg.exe')) { 'yes' } else { 'no' }
        Address   = '(binary)'
        Listening = 'n/a'
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Host

    # Neighbouring database servers this project must never touch.
    foreach ($foreign in @(@{ Port = 3306; What = 'XAMPP MariaDB' }, @{ Port = 3307; What = 'silkgrain MySQL' })) {
        if (Test-PortOpen -Port $foreign.Port) {
            Write-Note "port $($foreign.Port) is busy ($($foreign.What)) - not ours, left alone"
        }
    }
}

function Invoke-Remove {
    Invoke-Stop
    if (-not (Test-Path $ServicesDir)) { Write-Note 'nothing to remove'; return }
    Write-Step 'Removing .services'
    Remove-Item -LiteralPath $ServicesDir -Recurse -Force
    Write-Ok 'removed'
}

switch ($Action) {
    'install' { Invoke-Install }
    'start' { Invoke-Start }
    'stop' { Invoke-Stop }
    'status' { Invoke-Status }
    'remove' { Invoke-Remove }
}
