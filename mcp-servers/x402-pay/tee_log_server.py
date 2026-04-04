#!/usr/bin/env python3
"""TEE pay log server — streams /tmp/tee_pay.log as SSE to a browser."""
import argparse
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from socketserver import ThreadingMixIn

LOG_PATH = Path("/tmp/tee_pay.log")


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TEE Card Issuer — Live Logs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #c9d1d9; font: 13px/1.6 "JetBrains Mono", "Fira Mono", monospace; }
    #header {
      position: sticky; top: 0; z-index: 10;
      background: #161b22; border-bottom: 1px solid #30363d;
      padding: 10px 20px; display: flex; align-items: center; gap: 14px;
    }
    #header h1 { font-size: 13px; color: #58a6ff; font-weight: 600; letter-spacing: .4px; }
    #dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; flex-shrink: 0; }
    #dot.off { background: #f85149; }
    #status { font-size: 11px; color: #6e7681; }
    #clear-btn {
      margin-left: auto; padding: 3px 10px; background: #21262d;
      border: 1px solid #30363d; color: #8b949e; border-radius: 6px;
      cursor: pointer; font: 12px inherit;
    }
    #clear-btn:hover { border-color: #58a6ff; color: #c9d1d9; }
    #log { padding: 14px 20px; }
    .line { display: block; padding: 1px 0; white-space: pre; }
    .line:hover { background: #161b22; }
    .sep   { color: #30363d; }
    .info  { color: #c9d1d9; }
    .warn  { color: #d29922; }
    .error { color: #f85149; }
    .ok    { color: #3fb950; }
    .pay   { color: #58a6ff; }
    .key   { color: #bc8cff; }
    label  { font-size: 11px; color: #6e7681; display: flex; align-items: center; gap: 5px; cursor: pointer; }
    #autoscroll { accent-color: #58a6ff; }
  </style>
</head>
<body>
  <div id="header">
    <div id="dot"></div>
    <h1>TEE Card Issuer</h1>
    <span id="status">connecting…</span>
    <label><input type="checkbox" id="autoscroll" checked> autoscroll</label>
    <button id="clear-btn" onclick="document.getElementById('log').innerHTML=''">Clear</button>
  </div>
  <div id="log"></div>
  <script>
    const logEl = document.getElementById('log');
    const dot = document.getElementById('dot');
    const status = document.getElementById('status');
    const autoscroll = document.getElementById('autoscroll');

    function classify(line) {
      if (/─+/.test(line)) return 'sep';
      if (/error|failed|invalid|fraud/i.test(line)) return 'error';
      if (/warn|missing|old code/i.test(line)) return 'warn';
      if (/✓|verified|decrypted|issued|complete/i.test(line)) return 'ok';
      if (/card request|← 402|→ submit|payment/i.test(line)) return 'pay';
      if (/keypair|pubkey|signing|sig=/i.test(line)) return 'key';
      return 'info';
    }

    function connect() {
      const es = new EventSource('/stream');
      es.onopen = () => {
        dot.className = '';
        status.textContent = 'live';
      };
      es.onmessage = e => {
        const span = document.createElement('span');
        span.className = 'line ' + classify(e.data);
        span.textContent = e.data;
        logEl.appendChild(span);
        if (autoscroll.checked) window.scrollTo(0, document.body.scrollHeight);
      };
      es.onerror = () => {
        dot.className = 'off';
        status.textContent = 'reconnecting…';
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
        pass

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

            offset = 0
            try:
                while True:
                    if LOG_PATH.exists():
                        with open(LOG_PATH) as f:
                            f.seek(offset)
                            for line in f:
                                data = line.rstrip("\n")
                                self.wfile.write(f"data: {data}\n\n".encode())
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
    parser.add_argument("--port", type=int, default=4243)
    args = parser.parse_args()
    print(f"TEE log server → http://localhost:{args.port}")
    print(f"Tailing: {LOG_PATH}")
    ThreadingHTTPServer(("", args.port), Handler).serve_forever()
