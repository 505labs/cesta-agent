import json
import time
import math
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8081

def build_prime_map(limit: int) -> dict[int, bool]:
    primes = {}
    for n in range(2, limit):
        is_prime = True
        for i in range(2, int(math.isqrt(n)) + 1):
            if n % i == 0:
                is_prime = False
                break
        if is_prime:
            primes[n] = True
    return primes

print(f"Building prime map for the first 1,000,000 numbers...")
start = time.time()
PRIME_MAP = build_prime_map(1_000_000)
ALL_PRIMES = sorted(PRIME_MAP.keys())
elapsed = time.time() - start
print(f"Found {len(ALL_PRIMES):,} primes in {elapsed:.2f}s")


class PrimeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path

        if path == "/":
            self._json(200, {
                "total_primes": len(ALL_PRIMES),
                "routes": [
                    "/", "/count", "/check/<n>",
                    "/first/<n>", "/sum/<n>",
                    "/range?start=X&end=Y",
                    "/primes?page=1&size=100",
                ],
            })

        elif path == "/count":
            self._json(200, {"count": len(ALL_PRIMES)})

        elif path.startswith("/check/"):
            try:
                n = int(path.split("/check/")[1])
                self._json(200, {"number": n, "is_prime": n in PRIME_MAP})
            except ValueError:
                self._json(400, {"error": "Invalid number"})

        elif path.startswith("/first/"):
            try:
                n = int(path.split("/first/")[1])
                n = min(n, len(ALL_PRIMES))
                primes = ALL_PRIMES[:n]
                self._json(200, {"n": n, "primes": primes, "sum": sum(primes)})
            except ValueError:
                self._json(400, {"error": "Invalid number"})

        elif path.startswith("/sum/"):
            try:
                n = int(path.split("/sum/")[1])
                n = min(n, len(ALL_PRIMES))
                total = sum(ALL_PRIMES[:n])
                self._json(200, {"n": n, "sum": total})
            except ValueError:
                self._json(400, {"error": "Invalid number"})

        elif path.startswith("/range"):
            params = self._parse_query(path)
            start = int(params.get("start", "2"))
            end = int(params.get("end", "100"))
            if end - start > 10000:
                self._json(400, {"error": "Range too large, max 10000"})
                return
            result = [n for n in range(max(2, start), end + 1) if n in PRIME_MAP]
            self._json(200, {"start": start, "end": end, "count": len(result), "primes": result, "sum": sum(result)})

        elif path.startswith("/primes"):
            params = self._parse_query(path)
            page = int(params.get("page", "1"))
            size = min(int(params.get("size", "100")), 1000)
            offset = (page - 1) * size
            chunk = ALL_PRIMES[offset:offset + size]
            self._json(200, {
                "page": page,
                "size": size,
                "total": len(ALL_PRIMES),
                "primes": chunk,
                "page_sum": sum(chunk),
            })

        else:
            self._json(404, {"error": "Not found"})

    def _json(self, status: int, body: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def _parse_query(self, path: str) -> dict[str, str]:
        params = {}
        if "?" in path:
            for pair in path.split("?")[1].split("&"):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    params[k] = v
        return params

    def log_message(self, format, *args):
        print(f"{self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), PrimeHandler)
    print(f"Prime server running at http://localhost:{PORT}")
    print(f"  /first/N   — get the first N primes + their sum")
    print(f"  /sum/N     — get just the sum of the first N primes")
    print(f"  /check/N   — check if N is prime")
    print(f"  /range     — primes in a range")
    print(f"  /primes    — paginated list of all primes")
    server.serve_forever()
