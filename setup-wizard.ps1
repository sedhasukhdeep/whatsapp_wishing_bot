# Wishing Bot Setup Wizard — Windows (PowerShell + Windows Forms)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition }

# ── Helper: compose command ──────────────────────────────────────────────────
function Get-ComposeCmd {
    $r = & docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) { return @('docker','compose') }
    return @('docker-compose')
}

function Set-EnvVar {
    param([string]$content, [string]$key, [string]$value)
    $lines = $content -split "`n"
    $found = $false
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match "^$key=") {
            $lines[$i] = "$key=$value"
            $found = $true
            break
        }
    }
    if (-not $found) { $lines += "$key=$value" }
    return ($lines -join "`n")
}

function Write-EnvFile {
    param([string]$provider, [string]$apiKey, [string]$timezone)
    $examplePath = Join-Path $ScriptDir ".env.example"
    $envPath = Join-Path $ScriptDir ".env"
    if (Test-Path $examplePath) {
        $content = Get-Content $examplePath -Raw
    } else {
        $content = "ANTHROPIC_API_KEY=`nOPENAI_API_KEY=`nGEMINI_API_KEY=`nAI_PROVIDER=auto`nSCHEDULER_TIMEZONE=Australia/Sydney`nSCHEDULER_HOUR=8`nSCHEDULER_MINUTE=0`n"
    }
    switch ($provider) {
        'claude' { $content = Set-EnvVar $content 'AI_PROVIDER' 'claude'; $content = Set-EnvVar $content 'ANTHROPIC_API_KEY' $apiKey }
        'openai' { $content = Set-EnvVar $content 'AI_PROVIDER' 'openai'; $content = Set-EnvVar $content 'OPENAI_API_KEY' $apiKey }
        'gemini' { $content = Set-EnvVar $content 'AI_PROVIDER' 'gemini'; $content = Set-EnvVar $content 'GEMINI_API_KEY' $apiKey }
        default  { $content = Set-EnvVar $content 'AI_PROVIDER' 'local' }
    }
    $content = Set-EnvVar $content 'SCHEDULER_TIMEZONE' $timezone
    # Write without BOM — critical for docker-compose
    [System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding $false))
}

# ── Form setup ───────────────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = "Wishing Bot Setup"
$form.Size = New-Object System.Drawing.Size(520, 580)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

function New-Label {
    param([string]$text, [int]$x, [int]$y, [int]$w=400, [int]$h=24, [int]$size=10, [bool]$bold=$false)
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $text
    $l.Location = New-Object System.Drawing.Point($x, $y)
    $l.Size = New-Object System.Drawing.Size($w, $h)
    if ($bold) { $l.Font = New-Object System.Drawing.Font("Segoe UI", $size, [System.Drawing.FontStyle]::Bold) }
    else { $l.Font = New-Object System.Drawing.Font("Segoe UI", $size) }
    $l.ForeColor = [System.Drawing.Color]::FromArgb(50,50,80)
    return $l
}

function New-Btn {
    param([string]$text, [int]$x, [int]$y, [int]$w=120, [bool]$primary=$true)
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.Location = New-Object System.Drawing.Point($x, $y)
    $b.Size = New-Object System.Drawing.Size($w, 36)
    $b.FlatStyle = "Flat"
    if ($primary) {
        $b.BackColor = [System.Drawing.Color]::FromArgb(102,126,234)
        $b.ForeColor = [System.Drawing.Color]::White
        $b.FlatAppearance.BorderSize = 0
    } else {
        $b.BackColor = [System.Drawing.Color]::FromArgb(240,240,240)
        $b.ForeColor = [System.Drawing.Color]::FromArgb(80,80,80)
    }
    $b.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    return $b
}

$panels = @{}

# ── Panel 1: Welcome ─────────────────────────────────────────────────────────
$p1 = New-Object System.Windows.Forms.Panel
$p1.Dock = "Fill"
$p1.BackColor = [System.Drawing.Color]::White
$p1.Controls.Add((New-Label "🎉 Wishing Bot" 40 80 400 50 22 $true))
$p1.Controls.Add((New-Label "Send AI-generated birthday and anniversary" 40 140 420 22))
$p1.Controls.Add((New-Label "wishes on WhatsApp — automatically." 40 165 420 22))
$btnStart = New-Btn "Get Started" 40 230 130
$p1.Controls.Add($btnStart)
$panels[1] = $p1

# ── Panel 2: Docker ───────────────────────────────────────────────────────────
$p2 = New-Object System.Windows.Forms.Panel
$p2.Dock = "Fill"
$p2.BackColor = [System.Drawing.Color]::White
$p2.Controls.Add((New-Label "Step 1 of 4: Docker Desktop" 40 40 400 28 14 $true))
$p2.Controls.Add((New-Label "Checking if Docker is installed and running..." 40 80 420 22))
$lblDockerStatus = New-Label "" 40 110 420 44
$lblDockerStatus.ForeColor = [System.Drawing.Color]::FromArgb(21,128,61)
$p2.Controls.Add($lblDockerStatus)
$lnkDocker = New-Object System.Windows.Forms.LinkLabel
$lnkDocker.Text = "Download Docker Desktop for Windows"
$lnkDocker.Location = New-Object System.Drawing.Point(40, 160)
$lnkDocker.Size = New-Object System.Drawing.Size(400, 22)
$lnkDocker.Visible = $false
$lnkDocker.Add_LinkClicked({ Start-Process "https://docs.docker.com/desktop/install/windows-install/" })
$p2.Controls.Add($lnkDocker)
$btnDockerCheck = New-Btn "Check Again" 160 220 120 $false
$btnDockerNext = New-Btn "Next" 40 220 120
$btnDockerNext.Enabled = $false
$p2.Controls.Add($btnDockerNext)
$p2.Controls.Add($btnDockerCheck)
$panels[2] = $p2

# ── Panel 3: AI Key ───────────────────────────────────────────────────────────
$p3 = New-Object System.Windows.Forms.Panel
$p3.Dock = "Fill"
$p3.BackColor = [System.Drawing.Color]::White
$p3.Controls.Add((New-Label "Step 2 of 4: AI Provider" 40 40 400 28 14 $true))
$p3.Controls.Add((New-Label "Choose how to generate messages. You can change this in Settings later." 40 78 420 40))

$rbClaude = New-Object System.Windows.Forms.RadioButton
$rbClaude.Text = "Claude (Anthropic) — best quality"
$rbClaude.Location = New-Object System.Drawing.Point(40, 128)
$rbClaude.Size = New-Object System.Drawing.Size(360, 22)
$rbClaude.Checked = $true

$rbOpenAI = New-Object System.Windows.Forms.RadioButton
$rbOpenAI.Text = "OpenAI (GPT-4o)"
$rbOpenAI.Location = New-Object System.Drawing.Point(40, 156)
$rbOpenAI.Size = New-Object System.Drawing.Size(360, 22)

$rbGemini = New-Object System.Windows.Forms.RadioButton
$rbGemini.Text = "Google Gemini"
$rbGemini.Location = New-Object System.Drawing.Point(40, 184)
$rbGemini.Size = New-Object System.Drawing.Size(360, 22)

$rbLocal = New-Object System.Windows.Forms.RadioButton
$rbLocal.Text = "Local AI (LM Studio / Ollama) — no API key needed"
$rbLocal.Location = New-Object System.Drawing.Point(40, 212)
$rbLocal.Size = New-Object System.Drawing.Size(420, 22)

$p3.Controls.Add($rbClaude)
$p3.Controls.Add($rbOpenAI)
$p3.Controls.Add($rbGemini)
$p3.Controls.Add($rbLocal)

$lblKeyName = New-Label "Anthropic API Key" 40 248 300 22
$p3.Controls.Add($lblKeyName)
$txtKey = New-Object System.Windows.Forms.TextBox
$txtKey.Location = New-Object System.Drawing.Point(40, 272)
$txtKey.Size = New-Object System.Drawing.Size(360, 28)
$txtKey.PasswordChar = '*'
$p3.Controls.Add($txtKey)
$lblKeyError = New-Label "" 40 304 380 22
$lblKeyError.ForeColor = [System.Drawing.Color]::Red
$p3.Controls.Add($lblKeyError)

$lnkKey = New-Object System.Windows.Forms.LinkLabel
$lnkKey.Text = "Get Anthropic API key →"
$lnkKey.Location = New-Object System.Drawing.Point(40, 330)
$lnkKey.Size = New-Object System.Drawing.Size(300, 22)
$lnkKey.Add_LinkClicked({ Start-Process "https://console.anthropic.com/" })
$p3.Controls.Add($lnkKey)

$btnKeyNext = New-Btn "Next" 40 380 120
$btnKeySkip = New-Btn "Skip" 170 380 100 $false
$btnKeyBack = New-Btn "Back" 280 380 100 $false
$p3.Controls.Add($btnKeyNext)
$p3.Controls.Add($btnKeySkip)
$p3.Controls.Add($btnKeyBack)

$providerLinks = @{
    'claude' = @{ label='Anthropic API Key'; link='https://console.anthropic.com/'; linkText='Get Anthropic API key →' }
    'openai' = @{ label='OpenAI API Key'; link='https://platform.openai.com/api-keys'; linkText='Get OpenAI API key →' }
    'gemini' = @{ label='Gemini API Key'; link='https://aistudio.google.com/app/apikey'; linkText='Get Gemini API key →' }
}

function Update-ProviderUI {
    if ($rbLocal.Checked) {
        $lblKeyName.Visible = $false; $txtKey.Visible = $false; $lnkKey.Visible = $false
    } else {
        $lblKeyName.Visible = $true; $txtKey.Visible = $true; $lnkKey.Visible = $true
        $p = if ($rbClaude.Checked) {'claude'} elseif ($rbOpenAI.Checked) {'openai'} else {'gemini'}
        $cfg = $providerLinks[$p]
        $lblKeyName.Text = $cfg.label
        $lnkKey.Text = $cfg.linkText
        $lnkKey.Links.Clear()
        $lnkKey.Links.Add(0, $lnkKey.Text.Length, $cfg.link) | Out-Null
        $lnkKey.Add_LinkClicked({ param($s,$e); Start-Process $e.Link.LinkData })
    }
}
$rbClaude.Add_CheckedChanged({ Update-ProviderUI })
$rbOpenAI.Add_CheckedChanged({ Update-ProviderUI })
$rbGemini.Add_CheckedChanged({ Update-ProviderUI })
$rbLocal.Add_CheckedChanged({ Update-ProviderUI })
$panels[3] = $p3

# ── Panel 4: Timezone ─────────────────────────────────────────────────────────
$p4 = New-Object System.Windows.Forms.Panel
$p4.Dock = "Fill"
$p4.BackColor = [System.Drawing.Color]::White
$p4.Controls.Add((New-Label "Step 3 of 4: Timezone" 40 40 400 28 14 $true))
$p4.Controls.Add((New-Label "Messages are scheduled at 8 AM in your timezone." 40 80 420 22))
$p4.Controls.Add((New-Label "Your timezone:" 40 120 200 22))
$cboTz = New-Object System.Windows.Forms.ComboBox
$cboTz.Location = New-Object System.Drawing.Point(40, 146)
$cboTz.Size = New-Object System.Drawing.Size(380, 28)
$cboTz.DropDownStyle = "DropDownList"
$tzList = @(
    'Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth',
    'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Shanghai',
    'Europe/London','Europe/Paris','Europe/Berlin',
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
    'America/Toronto','America/Sao_Paulo','Africa/Johannesburg','Pacific/Auckland'
)
$tzList | ForEach-Object { $cboTz.Items.Add($_) | Out-Null }
$cboTz.SelectedIndex = 0
$p4.Controls.Add($cboTz)
$btnTzInstall = New-Btn "Install" 40 210 120
$btnTzBack = New-Btn "Back" 170 210 100 $false
$p4.Controls.Add($btnTzInstall)
$p4.Controls.Add($btnTzBack)
$panels[4] = $p4

# ── Panel 5: Installing ───────────────────────────────────────────────────────
$p5 = New-Object System.Windows.Forms.Panel
$p5.Dock = "Fill"
$p5.BackColor = [System.Drawing.Color]::White
$p5.Controls.Add((New-Label "Installing..." 40 40 400 28 14 $true))
$lblInstallStatus = New-Label "Building Docker images..." 40 80 420 22
$p5.Controls.Add($lblInstallStatus)
$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(40, 112)
$progressBar.Size = New-Object System.Drawing.Size(420, 12)
$progressBar.Style = "Marquee"
$progressBar.MarqueeAnimationSpeed = 30
$p5.Controls.Add($progressBar)
$rtbLog = New-Object System.Windows.Forms.RichTextBox
$rtbLog.Location = New-Object System.Drawing.Point(40, 134)
$rtbLog.Size = New-Object System.Drawing.Size(420, 300)
$rtbLog.BackColor = [System.Drawing.Color]::FromArgb(30,30,46)
$rtbLog.ForeColor = [System.Drawing.Color]::FromArgb(205,214,244)
$rtbLog.Font = New-Object System.Drawing.Font("Consolas", 9)
$rtbLog.ReadOnly = $true
$rtbLog.ScrollBars = "Vertical"
$p5.Controls.Add($rtbLog)
$lblInstallError = New-Label "" 40 444 420 22
$lblInstallError.ForeColor = [System.Drawing.Color]::Red
$p5.Controls.Add($lblInstallError)
$panels[5] = $p5

# ── Panel 6: Done ─────────────────────────────────────────────────────────────
$p6 = New-Object System.Windows.Forms.Panel
$p6.Dock = "Fill"
$p6.BackColor = [System.Drawing.Color]::White
$p6.Controls.Add((New-Label "✅  You're all set!" 40 80 400 40 18 $true))
$p6.Controls.Add((New-Label "Wishing Bot is running." 40 130 400 24))
$p6.Controls.Add((New-Label "Next: go to WhatsApp in the sidebar and scan the QR" 40 164 420 24))
$p6.Controls.Add((New-Label "code with your phone. You only need to do this once." 40 190 420 24))
$btnOpenApp = New-Btn "Open Wishing Bot" 40 250 160
$btnClose = New-Btn "Close" 210 250 100 $false
$p6.Controls.Add($btnOpenApp)
$p6.Controls.Add($btnClose)
$panels[6] = $p6

# Add all panels (hidden except 1)
foreach ($kv in $panels.GetEnumerator()) {
    $kv.Value.Visible = ($kv.Key -eq 1)
    $form.Controls.Add($kv.Value)
}

function Show-Panel($n) {
    foreach ($kv in $panels.GetEnumerator()) { $kv.Value.Visible = ($kv.Key -eq $n) }
}

# ── Navigation wiring ─────────────────────────────────────────────────────────
$btnStart.Add_Click({ Show-Panel 2; Check-Docker })

function Check-Docker {
    $lblDockerStatus.ForeColor = [System.Drawing.Color]::FromArgb(50,50,200)
    $lblDockerStatus.Text = "Checking Docker..."
    $btnDockerNext.Enabled = $false
    $lnkDocker.Visible = $false
    $form.Refresh()
    $r = & docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        $lblDockerStatus.ForeColor = [System.Drawing.Color]::Red
        $lblDockerStatus.Text = "Docker is not running. Start Docker Desktop and try again."
        $lnkDocker.Visible = $true
    } else {
        $vr = & docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ver = ($vr | Select-Object -First 1).ToString().Trim()
        } else {
            $ver = "docker-compose (legacy)"
        }
        $lblDockerStatus.ForeColor = [System.Drawing.Color]::FromArgb(21,128,61)
        $lblDockerStatus.Text = "Docker is running — $ver"
        $btnDockerNext.Enabled = $true
    }
}

$btnDockerCheck.Add_Click({ Check-Docker })
$btnDockerNext.Add_Click({ Show-Panel 3; Update-ProviderUI })

$btnKeyBack.Add_Click({ Show-Panel 2 })
$btnKeySkip.Add_Click({
    $script:selectedProvider = 'local'
    $script:selectedKey = ''
    Show-Panel 4
})
$btnKeyNext.Add_Click({
    $p = if ($rbClaude.Checked) {'claude'} elseif ($rbOpenAI.Checked) {'openai'} elseif ($rbGemini.Checked) {'gemini'} else {'local'}
    $k = $txtKey.Text.Trim()
    if ($p -ne 'local' -and $k -eq '') {
        $lblKeyError.Text = "Please enter an API key, or click Skip."
        return
    }
    $lblKeyError.Text = ''
    $script:selectedProvider = $p
    $script:selectedKey = $k
    Show-Panel 4
})

$btnTzBack.Add_Click({ Show-Panel 3 })
$btnTzInstall.Add_Click({
    $script:selectedTimezone = $cboTz.SelectedItem.ToString()
    Show-Panel 5
    Start-Install
})

$btnOpenApp.Add_Click({ Start-Process "http://localhost"; $form.Close() })
$btnClose.Add_Click({ $form.Close() })

# ── Install logic (BackgroundWorker) ─────────────────────────────────────────
$worker = New-Object System.ComponentModel.BackgroundWorker
$worker.WorkerReportsProgress = $true

$worker.Add_DoWork({
    param($sender, $e)
    $provider  = $e.Argument.provider
    $apiKey    = $e.Argument.apiKey
    $timezone  = $e.Argument.timezone

    function Log($msg) { $sender.ReportProgress(0, $msg) }
    function Status($msg) { $sender.ReportProgress(1, $msg) }

    try {
        Log "Writing .env file..."
        Write-EnvFile $provider $apiKey $timezone
        Log ".env created."

        $compose = Get-ComposeCmd
        $composeStr = $compose -join ' '

        Status "Building Docker images..."
        Log "$ $composeStr build"
        $proc = Start-Process -FilePath $compose[0] -ArgumentList ($compose[1..($compose.Length-1)] + 'build') `
            -WorkingDirectory $ScriptDir -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\wb_build.log" `
            -RedirectStandardError "$env:TEMP\wb_build_err.log"
        # Stream log lines
        $lastPos = 0
        while (-not $proc.HasExited) {
            Start-Sleep -Milliseconds 300
            if (Test-Path "$env:TEMP\wb_build.log") {
                $lines = Get-Content "$env:TEMP\wb_build.log" -Raw
                if ($lines -and $lines.Length -gt $lastPos) {
                    $new = $lines.Substring($lastPos)
                    $lastPos = $lines.Length
                    $new -split "`n" | Where-Object { $_ } | ForEach-Object { Log $_ }
                }
            }
        }
        if ($proc.ExitCode -ne 0) { throw "docker compose build failed (exit $($proc.ExitCode)). Check log above." }

        Status "Starting containers..."
        Log "$ $composeStr up -d"
        $out = & $compose[0] ($compose[1..($compose.Length-1)] + @('up','-d')) 2>&1
        $out | ForEach-Object { Log $_.ToString() }
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }

        Status "Running database migrations..."
        Start-Sleep -Seconds 6
        Log "$ $composeStr exec -T backend alembic upgrade head"
        $out2 = & $compose[0] ($compose[1..($compose.Length-1)] + @('exec','-T','backend','alembic','upgrade','head')) 2>&1
        $out2 | ForEach-Object { Log $_.ToString() }
        if ($LASTEXITCODE -ne 0) { throw "Database migration failed." }

        Log ""
        Log "Setup complete!"
        $e.Result = "ok"
    } catch {
        $e.Result = "error:" + $_.Exception.Message
    }
})

$worker.Add_ProgressChanged({
    param($sender, $e)
    if ($e.ProgressPercentage -eq 0) {
        $rtbLog.AppendText($e.UserState.ToString() + "`n")
        $rtbLog.ScrollToCaret()
    } elseif ($e.ProgressPercentage -eq 1) {
        $lblInstallStatus.Text = $e.UserState.ToString()
    }
})

$worker.Add_RunWorkerCompleted({
    param($sender, $e)
    $progressBar.Style = "Continuous"
    $progressBar.Value = 100
    if ($e.Result -and $e.Result.ToString().StartsWith("error:")) {
        $lblInstallError.Text = "Installation failed: " + $e.Result.ToString().Substring(6)
        $rtbLog.AppendText("`n[ERROR] " + $e.Result.ToString().Substring(6) + "`n")
    } else {
        Start-Sleep -Milliseconds 800
        Show-Panel 6
    }
})

function Start-Install {
    $rtbLog.Text = ""
    $lblInstallError.Text = ""
    $progressBar.Style = "Marquee"
    $worker.RunWorkerAsync([PSCustomObject]@{
        provider = $script:selectedProvider
        apiKey   = $script:selectedKey
        timezone = $script:selectedTimezone
    })
}

# ── Run ───────────────────────────────────────────────────────────────────────
[System.Windows.Forms.Application]::Run($form)
