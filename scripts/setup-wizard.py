#!/usr/bin/env python3
"""
Wishing Bot Setup Wizard — Mac/Linux
Starts a local HTTP server on port 8765 and serves a browser-based install wizard.
Stdlib only — no pip required.
"""

import http.server
import json
import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).parent.parent.resolve()

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wishing Bot Setup</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: white;
    border-radius: 16px;
    padding: 48px;
    max-width: 560px;
    width: 100%;
    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
  }
  .step { display: none; }
  .step.active { display: block; }
  h1 { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
  h2 { font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px; }
  .tagline { color: #666; font-size: 16px; margin-bottom: 32px; line-height: 1.5; }
  .logo { font-size: 48px; margin-bottom: 16px; }
  .btn {
    display: inline-block;
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }
  .btn-primary { background: #667eea; color: white; }
  .btn-primary:hover:not(:disabled) { background: #5a6fd6; transform: translateY(-1px); }
  .btn-primary:disabled { background: #ccc; cursor: not-allowed; transform: none; }
  .btn-secondary { background: #f0f0f0; color: #555; margin-left: 10px; }
  .btn-secondary:hover { background: #e4e4e4; }
  .status-box {
    border-radius: 10px;
    padding: 16px 20px;
    margin: 16px 0;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .status-ok { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
  .status-err { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
  .status-loading { background: #f8faff; border: 1px solid #c7d2fe; color: #3730a3; }
  .icon { font-size: 20px; flex-shrink: 0; }
  label { display: block; font-weight: 600; color: #333; margin-bottom: 6px; margin-top: 18px; font-size: 14px; }
  input[type=text], input[type=password], select {
    width: 100%;
    padding: 10px 14px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus { border-color: #667eea; }
  .radio-group { margin: 12px 0; }
  .radio-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border: 1.5px solid #e8e8e8;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .radio-item:hover { border-color: #667eea; }
  .radio-item.selected { border-color: #667eea; background: #f5f7ff; }
  .radio-item input { margin-top: 2px; accent-color: #667eea; }
  .radio-label { font-weight: 600; font-size: 14px; }
  .radio-desc { font-size: 12px; color: #888; margin-top: 2px; }
  .key-link { font-size: 12px; color: #667eea; text-decoration: none; margin-top: 4px; display: inline-block; }
  .key-link:hover { text-decoration: underline; }
  #log-box {
    background: #1e1e2e;
    color: #cdd6f4;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    border-radius: 8px;
    padding: 16px;
    height: 260px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 16px 0;
  }
  .progress-bar {
    width: 100%;
    height: 6px;
    background: #e8e8e8;
    border-radius: 3px;
    overflow: hidden;
    margin: 12px 0;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    border-radius: 3px;
    width: 0%;
    transition: width 0.4s ease;
    animation: indeterminate 1.5s infinite ease-in-out;
  }
  @keyframes indeterminate {
    0% { transform: translateX(-100%); width: 60%; }
    100% { transform: translateX(200%); width: 60%; }
  }
  .progress-fill.done { animation: none; width: 100%; }
  .step-indicator {
    display: flex;
    gap: 6px;
    margin-bottom: 28px;
  }
  .step-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #e0e0e0;
    transition: background 0.2s;
  }
  .step-dot.active { background: #667eea; }
  .step-dot.done { background: #86efac; }
  .hint { font-size: 12px; color: #999; margin-top: 6px; }
  .key-input-wrap { position: relative; }
  .toggle-key {
    position: absolute; right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    cursor: pointer; color: #888; font-size: 12px;
  }
  .error-msg { color: #dc2626; font-size: 13px; margin-top: 6px; }
  a { color: #667eea; }
</style>
</head>
<body>
<div class="card">

  <!-- Step 1: Welcome -->
  <div class="step active" id="step-1">
    <div class="logo">🎉</div>
    <h1>Wishing Bot</h1>
    <p class="tagline">Send AI-generated birthday and anniversary wishes on WhatsApp — automatically.</p>
    <button class="btn btn-primary" onclick="goTo(2)">Get Started</button>
  </div>

  <!-- Step 2: Docker check -->
  <div class="step" id="step-2">
    <div class="step-indicator">
      <div class="step-dot done" id="dot-1"></div>
      <div class="step-dot active" id="dot-2"></div>
      <div class="step-dot" id="dot-3"></div>
      <div class="step-dot" id="dot-4"></div>
      <div class="step-dot" id="dot-5"></div>
      <div class="step-dot" id="dot-6"></div>
    </div>
    <h2>Docker Desktop</h2>
    <p class="tagline">Wishing Bot runs inside Docker. Let's check if it's installed and running.</p>
    <div id="docker-status" class="status-box status-loading">
      <span class="icon">⏳</span> Checking Docker...
    </div>
    <div id="docker-download" style="display:none; margin-top: 12px;">
      <p style="font-size:14px; color:#555;">Download and install Docker Desktop, then click <strong>Check again</strong>.</p>
      <p style="margin-top:8px;">
        <a href="https://docs.docker.com/desktop/install/mac-install/" target="_blank">Download for Mac</a> &nbsp;|&nbsp;
        <a href="https://docs.docker.com/desktop/install/linux-install/" target="_blank">Download for Linux</a>
      </p>
    </div>
    <div style="margin-top: 24px;">
      <button class="btn btn-primary" id="docker-next" disabled onclick="goTo(3)">Next</button>
      <button class="btn btn-secondary" onclick="checkDocker()">Check again</button>
    </div>
  </div>

  <!-- Step 3: AI Key -->
  <div class="step" id="step-3">
    <div class="step-indicator">
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot active"></div>
      <div class="step-dot"></div>
      <div class="step-dot"></div>
      <div class="step-dot"></div>
    </div>
    <h2>AI Provider</h2>
    <p class="tagline">Choose how to generate your messages. You can change this later in Settings.</p>

    <div class="radio-group">
      <label class="radio-item selected" id="opt-claude" onclick="selectProvider('claude')">
        <input type="radio" name="provider" value="claude" checked>
        <div>
          <div class="radio-label">Claude (Anthropic)</div>
          <div class="radio-desc">Best quality. Needs an Anthropic API key.</div>
        </div>
      </label>
      <label class="radio-item" id="opt-openai" onclick="selectProvider('openai')">
        <input type="radio" name="provider" value="openai">
        <div>
          <div class="radio-label">OpenAI (GPT-4o)</div>
          <div class="radio-desc">Great quality. Needs an OpenAI API key.</div>
        </div>
      </label>
      <label class="radio-item" id="opt-gemini" onclick="selectProvider('gemini')">
        <input type="radio" name="provider" value="gemini">
        <div>
          <div class="radio-label">Google Gemini</div>
          <div class="radio-desc">Good quality. Needs a Gemini API key.</div>
        </div>
      </label>
      <label class="radio-item" id="opt-local" onclick="selectProvider('local')">
        <input type="radio" name="provider" value="local">
        <div>
          <div class="radio-label">Local AI (LM Studio / Ollama)</div>
          <div class="radio-desc">Free, runs on your machine. No API key needed.</div>
        </div>
      </label>
    </div>

    <div id="key-section">
      <label id="key-label">Anthropic API Key</label>
      <div class="key-input-wrap">
        <input type="password" id="api-key" placeholder="sk-ant-..." autocomplete="off">
        <button class="toggle-key" onclick="toggleKey()">show</button>
      </div>
      <a id="key-link" class="key-link" href="https://console.anthropic.com/" target="_blank">Get your API key →</a>
      <div class="error-msg" id="key-error"></div>
    </div>

    <div style="margin-top: 24px;">
      <button class="btn btn-primary" onclick="validateKey()">Next</button>
      <button class="btn btn-secondary" onclick="skipKey()">Skip for now</button>
    </div>
  </div>

  <!-- Step 4: Timezone -->
  <div class="step" id="step-4">
    <div class="step-indicator">
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot active"></div>
      <div class="step-dot"></div>
      <div class="step-dot"></div>
    </div>
    <h2>Timezone</h2>
    <p class="tagline">Messages are scheduled at 8 AM in your timezone so they're ready when you wake up.</p>
    <label>Your timezone</label>
    <select id="timezone">
      <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
      <option value="Australia/Melbourne">Australia/Melbourne (AEDT)</option>
      <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
      <option value="Australia/Perth">Australia/Perth (AWST)</option>
      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
      <option value="Europe/London">Europe/London (GMT/BST)</option>
      <option value="Europe/Paris">Europe/Paris (CET)</option>
      <option value="Europe/Berlin">Europe/Berlin (CET)</option>
      <option value="America/New_York">America/New_York (EST)</option>
      <option value="America/Chicago">America/Chicago (CST)</option>
      <option value="America/Denver">America/Denver (MST)</option>
      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
      <option value="America/Toronto">America/Toronto (EST)</option>
      <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
      <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
      <option value="Pacific/Auckland">Pacific/Auckland (NZDT)</option>
    </select>
    <div style="margin-top: 24px;">
      <button class="btn btn-primary" onclick="startInstall()">Install</button>
      <button class="btn btn-secondary" onclick="goTo(3)">Back</button>
    </div>
  </div>

  <!-- Step 5: Installing -->
  <div class="step" id="step-5">
    <div class="step-indicator">
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot active"></div>
      <div class="step-dot"></div>
    </div>
    <h2>Installing...</h2>
    <p class="tagline" id="install-status">Building Docker images. This takes a few minutes on first run.</p>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
    <div id="log-box"></div>
    <div id="install-error" style="display:none;">
      <p class="error-msg" style="margin-top:8px;">Installation failed. See log above for details.</p>
      <button class="btn btn-secondary" style="margin-top:12px;" onclick="goTo(4)">Back</button>
    </div>
  </div>

  <!-- Step 6: Done -->
  <div class="step" id="step-6">
    <div class="step-indicator">
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot done"></div>
      <div class="step-dot active"></div>
    </div>
    <div class="logo">✅</div>
    <h2>You're all set!</h2>
    <p class="tagline">Wishing Bot is running. One last step — connect WhatsApp.</p>
    <div class="status-box status-ok">
      <span class="icon">📱</span>
      <div>Go to <strong>WhatsApp</strong> in the sidebar and scan the QR code with your phone. You only need to do this once.</div>
    </div>
    <div style="margin-top: 24px;">
      <button class="btn btn-primary" onclick="openApp()">Open Wishing Bot</button>
      <button class="btn btn-secondary" onclick="window.close()">Close</button>
    </div>
  </div>

</div>

<script>
let selectedProvider = 'claude';
let installConfig = {};

function goTo(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  if (n === 2) checkDocker();
}

// Step 2 — Docker
async function checkDocker() {
  const box = document.getElementById('docker-status');
  const btn = document.getElementById('docker-next');
  const dl = document.getElementById('docker-download');
  box.className = 'status-box status-loading';
  box.innerHTML = '<span class="icon">⏳</span> Checking Docker...';
  btn.disabled = true;
  dl.style.display = 'none';
  try {
    const r = await fetch('/api/docker');
    const d = await r.json();
    if (d.ok) {
      box.className = 'status-box status-ok';
      box.innerHTML = '<span class="icon">✓</span> Docker is running — version ' + d.version;
      btn.disabled = false;
    } else {
      box.className = 'status-box status-err';
      box.innerHTML = '<span class="icon">✗</span> ' + d.error;
      dl.style.display = 'block';
    }
  } catch(e) {
    box.className = 'status-box status-err';
    box.innerHTML = '<span class="icon">✗</span> Could not reach setup server. Try refreshing.';
  }
}

// Step 3 — Provider
const providerConfig = {
  claude:  { label: 'Anthropic API Key', placeholder: 'sk-ant-...', link: 'https://console.anthropic.com/', linkText: 'Get Anthropic API key →' },
  openai:  { label: 'OpenAI API Key',    placeholder: 'sk-...',     link: 'https://platform.openai.com/api-keys', linkText: 'Get OpenAI API key →' },
  gemini:  { label: 'Gemini API Key',    placeholder: 'AIza...',    link: 'https://aistudio.google.com/app/apikey', linkText: 'Get Gemini API key →' },
  local:   { label: null }
};

function selectProvider(p) {
  selectedProvider = p;
  ['claude','openai','gemini','local'].forEach(x => {
    document.getElementById('opt-' + x).classList.toggle('selected', x === p);
    document.querySelector('#opt-' + x + ' input').checked = (x === p);
  });
  const cfg = providerConfig[p];
  const ks = document.getElementById('key-section');
  if (!cfg.label) {
    ks.style.display = 'none';
  } else {
    ks.style.display = 'block';
    document.getElementById('key-label').textContent = cfg.label;
    document.getElementById('api-key').placeholder = cfg.placeholder;
    document.getElementById('api-key').value = '';
    document.getElementById('key-link').href = cfg.link;
    document.getElementById('key-link').textContent = cfg.linkText;
    document.getElementById('key-error').textContent = '';
  }
}

function toggleKey() {
  const inp = document.getElementById('api-key');
  const btn = document.querySelector('.toggle-key');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'hide'; }
  else { inp.type = 'password'; btn.textContent = 'show'; }
}

function validateKey() {
  const key = document.getElementById('api-key').value.trim();
  const err = document.getElementById('key-error');
  if (selectedProvider !== 'local' && !key) {
    err.textContent = 'Please enter an API key, or click Skip to configure later.';
    return;
  }
  installConfig.provider = selectedProvider;
  installConfig.apiKey = key;
  err.textContent = '';
  goTo(4);
}

function skipKey() {
  installConfig.provider = 'local';
  installConfig.apiKey = '';
  goTo(4);
}

// Step 4 → 5: Start install
async function startInstall() {
  installConfig.timezone = document.getElementById('timezone').value;
  goTo(5);

  const logBox = document.getElementById('log-box');
  const fill = document.getElementById('progress-fill');
  logBox.textContent = '';

  // Start SSE stream
  const params = new URLSearchParams({
    provider: installConfig.provider || 'local',
    api_key: installConfig.apiKey || '',
    timezone: installConfig.timezone
  });

  const evtSource = new EventSource('/api/setup-stream?' + params.toString());

  evtSource.onmessage = function(e) {
    const data = JSON.parse(e.data);
    if (data.type === 'log') {
      logBox.textContent += data.line + '\n';
      logBox.scrollTop = logBox.scrollHeight;
    } else if (data.type === 'status') {
      document.getElementById('install-status').textContent = data.msg;
    } else if (data.type === 'done') {
      evtSource.close();
      fill.classList.add('done');
      setTimeout(() => goTo(6), 1200);
    } else if (data.type === 'error') {
      evtSource.close();
      fill.style.animation = 'none';
      fill.style.background = '#f87171';
      document.getElementById('install-error').style.display = 'block';
      logBox.textContent += '\n[ERROR] ' + data.msg + '\n';
      logBox.scrollTop = logBox.scrollHeight;
    }
  };

  evtSource.onerror = function() {
    evtSource.close();
    document.getElementById('install-error').style.display = 'block';
    logBox.textContent += '\n[ERROR] Lost connection to setup server.\n';
  };
}

// Step 6
async function openApp() {
  await fetch('/api/open', { method: 'POST' });
  window.close();
}

// Auto-start docker check when page loads
window.onload = function() {
  // Pre-select Sydney timezone if browser is in AU
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sel = document.getElementById('timezone');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === tz) { sel.selectedIndex = i; break; }
  }
};
</script>
</body>
</html>
"""


def run_command(cmd, cwd=None):
    """Run a command and yield output lines."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=cwd or str(ROOT),
        text=True,
        bufsize=1,
    )
    for line in proc.stdout:
        yield line.rstrip()
    proc.wait()
    return proc.returncode


def get_compose_cmd():
    """Return ['docker', 'compose'] or ['docker-compose']."""
    try:
        subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True, check=True
        )
        return ["docker", "compose"]
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ["docker-compose"]


def write_env(provider, api_key, timezone):
    """Write .env from .env.example with user values substituted."""
    example = ROOT / ".env.example"
    env_path = ROOT / ".env"

    if example.exists():
        content = example.read_text()
    else:
        content = (
            "ANTHROPIC_API_KEY=\nOPENAI_API_KEY=\nGEMINI_API_KEY=\n"
            "AI_PROVIDER=auto\nSCHEDULER_TIMEZONE=Australia/Sydney\n"
            "SCHEDULER_HOUR=8\nSCHEDULER_MINUTE=0\n"
        )

    # Set AI provider
    if provider == "claude":
        content = _set_var(content, "AI_PROVIDER", "claude")
        content = _set_var(content, "ANTHROPIC_API_KEY", api_key)
    elif provider == "openai":
        content = _set_var(content, "AI_PROVIDER", "openai")
        content = _set_var(content, "OPENAI_API_KEY", api_key)
    elif provider == "gemini":
        content = _set_var(content, "AI_PROVIDER", "gemini")
        content = _set_var(content, "GEMINI_API_KEY", api_key)
    else:  # local
        content = _set_var(content, "AI_PROVIDER", "local")

    content = _set_var(content, "SCHEDULER_TIMEZONE", timezone)
    env_path.write_text(content)


def _set_var(content, key, value):
    """Replace KEY=... line in env content."""
    lines = content.splitlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith(key + "="):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    return "\n".join(lines) + "\n"


class WizardHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress access log

    def do_GET(self):
        if self.path == "/":
            self._html()
        elif self.path == "/api/docker":
            self._docker_check()
        elif self.path.startswith("/api/setup-stream"):
            self._setup_stream()
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/open":
            webbrowser.open("http://localhost")
            self._json({"ok": True})
        else:
            self.send_error(404)

    def _html(self):
        body = HTML.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _docker_check(self):
        try:
            r = subprocess.run(
                ["docker", "info"], capture_output=True, timeout=10
            )
            if r.returncode != 0:
                self._json({"ok": False, "error": "Docker is installed but not running. Please start Docker Desktop."})
                return
            vr = subprocess.run(
                ["docker", "compose", "version"], capture_output=True, text=True, timeout=5
            )
            if vr.returncode == 0:
                ver = vr.stdout.strip().split("version")[-1].strip().split()[0]
            else:
                vr2 = subprocess.run(
                    ["docker-compose", "--version"], capture_output=True, text=True, timeout=5
                )
                ver = vr2.stdout.strip().split()[-1] if vr2.returncode == 0 else "unknown"
            self._json({"ok": True, "version": ver})
        except FileNotFoundError:
            self._json({"ok": False, "error": "Docker not found. Please install Docker Desktop."})
        except Exception as e:
            self._json({"ok": False, "error": str(e)})

    def _setup_stream(self):
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        provider = qs.get("provider", ["local"])[0]
        api_key = qs.get("api_key", [""])[0]
        timezone = qs.get("timezone", ["Australia/Sydney"])[0]

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        def send_event(data):
            msg = f"data: {json.dumps(data)}\n\n"
            try:
                self.wfile.write(msg.encode())
                self.wfile.flush()
            except BrokenPipeError:
                pass

        def send_log(line):
            send_event({"type": "log", "line": line})

        def send_status(msg):
            send_event({"type": "status", "msg": msg})

        try:
            send_log("Writing .env file...")
            write_env(provider, api_key, timezone)
            send_log(".env created.")

            compose = get_compose_cmd()

            send_status("Building Docker images (this may take a few minutes)...")
            send_log("$ " + " ".join(compose + ["build"]))
            proc = subprocess.Popen(
                compose + ["build"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(ROOT),
                text=True,
                bufsize=1,
            )
            for line in proc.stdout:
                send_log(line.rstrip())
            proc.wait()
            if proc.returncode != 0:
                send_event({"type": "error", "msg": "docker compose build failed."})
                return

            send_status("Starting containers...")
            send_log("$ " + " ".join(compose + ["up", "-d"]))
            proc2 = subprocess.Popen(
                compose + ["up", "-d"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(ROOT),
                text=True,
                bufsize=1,
            )
            for line in proc2.stdout:
                send_log(line.rstrip())
            proc2.wait()
            if proc2.returncode != 0:
                send_event({"type": "error", "msg": "docker compose up failed."})
                return

            send_status("Running database migrations...")
            send_log("$ " + " ".join(compose + ["exec", "-T", "backend", "alembic", "upgrade", "head"]))
            # Wait briefly for backend to start
            time.sleep(5)
            proc3 = subprocess.Popen(
                compose + ["exec", "-T", "backend", "alembic", "upgrade", "head"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(ROOT),
                text=True,
                bufsize=1,
            )
            for line in proc3.stdout:
                send_log(line.rstrip())
            proc3.wait()
            if proc3.returncode != 0:
                send_event({"type": "error", "msg": "Database migration failed."})
                return

            send_log("")
            send_log("Setup complete!")
            send_event({"type": "done"})

        except Exception as e:
            send_event({"type": "error", "msg": str(e)})


def main():
    server = http.server.HTTPServer(("127.0.0.1", PORT), WizardHandler)
    print(f"Setup wizard running at http://localhost:{PORT}")
    print("Opening browser...")
    # Small delay so server is ready before browser opens
    threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSetup wizard closed.")


if __name__ == "__main__":
    main()
