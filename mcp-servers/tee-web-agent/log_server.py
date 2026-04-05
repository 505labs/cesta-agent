#!/usr/bin/env python3
"""
Tiny log streaming server — serves /tmp/agent_pay.log as SSE to a browser.

Usage:
  python log_server.py          # serves on http://localhost:4242
  python log_server.py --port 5000
"""
import argparse
import os
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
import tempfile
from pathlib import Path

LOG_PATH = Path(tempfile.gettempdir()) / "agent_pay.log"

HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TEE Web Agent — Live Logs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #c9d1d9; font: 13px/1.5 "JetBrains Mono", "Fira Mono", monospace; }
    #header {
      position: sticky; top: 0; z-index: 10;
      background: #161b22; border-bottom: 1px solid #30363d;
      padding: 10px 16px; display: flex; align-items: center; gap: 12px;
    }
    #header h1 { font-size: 14px; color: #58a6ff; }
    #status { font-size: 12px; }
    #status.connected { color: #3fb950; }
    #status.disconnected { color: #f85149; }
    #clear-btn {
      margin-left: auto; padding: 4px 12px; background: #21262d;
      border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px;
      cursor: pointer; font: inherit;
    }
    #clear-btn:hover { background: #30363d; }
    #log {
      padding: 12px 16px;
      white-space: pre-wrap; word-break: break-all;
    }
    .line { display: block; padding: 1px 0; }
    .line:hover { background: #161b22; }
    /* colourise by keyword */
    .line.info  { color: #c9d1d9; }
    .line.debug { color: #6e7681; }
    .line.warn  { color: #d29922; }
    .line.error { color: #f85149; }
    .line.ok    { color: #3fb950; }
    .line.pay   { color: #58a6ff; }
    #autoscroll { accent-color: #58a6ff; cursor: pointer; }
  </style>
</head>
<body>
  <div id="header">
    <h1>TEE Web Agent — Live Logs</h1>
    <span id="status" class="disconnected">● disconnected</span>
    <label style="font-size:12px; display:flex; align-items:center; gap:6px;">
      <input type="checkbox" id="autoscroll" checked> auto-scroll
    </label>
    <button id="clear-btn" onclick="document.getElementById('log').innerHTML=''">Clear</button>
  </div>
  <div id="log"></div>
  <script>
    const log = document.getElementById('log');
    const status = document.getElementById('status');
    const autoscroll = document.getElementById('autoscroll');

    function classify(line) {
      if (/\\[DEBUG\\]/.test(line)) return 'debug';
      if (/\\[WARNING\\]/.test(line)) return 'warn';
      if (/\\[ERROR\\]/.test(line) || /❌/.test(line)) return 'error';
      if (/✅|🎉|💳|🔓/.test(line)) return 'ok';
      if (/💸|🔗|📡|x402|tx_hash|EURC|USDC/.test(line)) return 'pay';
      return 'info';
    }

    function connect() {
      const es = new EventSource('/stream');
      es.onopen = () => {
        status.textContent = '● connected';
        status.className = 'connected';
      };
      es.onmessage = (e) => {
        const span = document.createElement('span');
        span.className = 'line ' + classify(e.data);
        span.textContent = e.data;
        log.appendChild(span);
        if (autoscroll.checked) window.scrollTo(0, document.body.scrollHeight);
      };
      es.onerror = () => {
        status.textContent = '● disconnected — reconnecting...';
        status.className = 'disconnected';
        es.close();
        setTimeout(connect, 2000);
      };
    }
    connect();
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence access log

    def do_GET(self):
        if self.path == "/":
            body = HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            # Stream existing content first, then tail
            offset = 0
            try:
                while True:
                    if LOG_PATH.exists():
                        with open(LOG_PATH) as f:
                            f.seek(offset)
                            for line in f:
                                # Only stream agent_pay logger lines (skip browser_use noise)
                                if "] agent_pay " not in line and " agent_pay —" not in line:
                                    continue
                                data = line.rstrip("\n")
                                msg = f"data: {data}\n\n".encode()
                                self.wfile.write(msg)
                                self.wfile.flush()
                            offset = f.tell()
                    time.sleep(0.1)
            except (BrokenPipeError, ConnectionResetError):
                pass

        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4242)
    args = parser.parse_args()

    print(f"Log server running → http://localhost:{args.port}")
    print(f"Tailing: {LOG_PATH}")
    ThreadingHTTPServer(("", args.port), Handler).serve_forever()
