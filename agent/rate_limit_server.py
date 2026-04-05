import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import defaultdict

# Config
PORT = 8080
RATE_LIMIT_BY_IP = 20       # requests per window per IP
RATE_LIMIT_BY_PATH = 50     # requests per window per path
WINDOW_SECONDS = 60         # sliding window size

ip_requests: dict[str, list[float]] = defaultdict(list)
path_requests: dict[str, list[float]] = defaultdict(list)


def is_rate_limited(store: dict[str, list[float]], key: str, limit: int) -> tuple[bool, int]:
    now = time.time()
    cutoff = now - WINDOW_SECONDS
    store[key] = [t for t in store[key] if t > cutoff]
    remaining = limit - len(store[key])
    if remaining <= 0:
        return True, 0
    store[key].append(now)
    return False, remaining - 1


class RateLimitHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        client_ip = self.client_address[0]
        path = self.path

        # Check IP rate limit
        ip_limited, ip_remaining = is_rate_limited(ip_requests, client_ip, RATE_LIMIT_BY_IP)
        if ip_limited:
            self._send_json(429, {
                "error": "Rate limited by IP",
                "ip": client_ip,
                "retry_after_seconds": WINDOW_SECONDS,
            })
            return

        # Check path rate limit
        path_limited, path_remaining = is_rate_limited(path_requests, path, RATE_LIMIT_BY_PATH)
        if path_limited:
            self._send_json(429, {
                "error": "Rate limited by path",
                "path": path,
                "retry_after_seconds": WINDOW_SECONDS,
            })
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-RateLimit-IP-Remaining", str(ip_remaining))
        self.send_header("X-RateLimit-Path-Remaining", str(path_remaining))
        self.end_headers()
        self.wfile.write(json.dumps({
            "message": "OK",
            "path": path,
            "ip": client_ip,
            "rate_limit": {
                "ip_remaining": ip_remaining,
                "path_remaining": path_remaining,
                "window_seconds": WINDOW_SECONDS,
            },
        }, indent=2).encode())

    do_POST = do_GET
    do_PUT = do_GET
    do_DELETE = do_GET

    def _send_json(self, status: int, body: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Retry-After", str(WINDOW_SECONDS))
        self.end_headers()
        self.wfile.write(json.dumps(body, indent=2).encode())

    def log_message(self, format, *args):
        print(f"[{self.client_address[0]}] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), RateLimitHandler)
    print(f"Rate-limiting server on http://localhost:{PORT}")
    print(f"  IP limit:   {RATE_LIMIT_BY_IP} req / {WINDOW_SECONDS}s")
    print(f"  Path limit: {RATE_LIMIT_BY_PATH} req / {WINDOW_SECONDS}s")
    server.serve_forever()
