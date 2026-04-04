import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";

const PORT = 44021; // Use a different port for tests to avoid collisions
const BASE = `http://localhost:${PORT}`;
const RECIPIENT = "0x0000000000000000000000000000000000000402";

// ---------------------------------------------------------------------------
// Helper: generate a valid X-PAYMENT header
// ---------------------------------------------------------------------------

function makePaymentHeader(
  endpoint: string,
  amount: string,
  recipient: string
): string {
  return btoa(
    JSON.stringify({
      from: "0xTestAgent",
      to: recipient,
      amount,
      network: "arc-testnet",
      token: "USDC",
      endpoint,
      timestamp: Date.now(),
    })
  );
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let server: ReturnType<typeof Bun.serve>;
let stats: { totalAmount: number; paymentCount: number; byEndpoint: Record<string, { amount: number; count: number }> };

beforeAll(async () => {
  // Override env for tests
  process.env.PORT = String(PORT);
  process.env.RECIPIENT_ADDRESS = RECIPIENT;
  process.env.NETWORK = "arc-testnet";

  // Dynamic import so env vars are picked up
  const mod = await import("./index.ts");
  server = mod.server;
  stats = mod.stats;
});

afterAll(() => {
  server?.stop();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("x402 Mock Server", () => {
  // 1. Health endpoint
  describe("GET /health", () => {
    test("returns 200 with status ok", async () => {
      const res = await fetch(`${BASE}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.protocol).toBe("x402-mock");
    });
  });

  // 2 & 3. Paid endpoints return 402 without X-PAYMENT header
  describe("402 Payment Required", () => {
    const paidEndpoints = [
      { path: "/gas-prices", price: "3000", desc: "Gas prices along route" },
      { path: "/restaurants", price: "5000", desc: "Restaurant recommendations along route" },
      { path: "/weather", price: "2000", desc: "Weather forecast for route" },
      { path: "/route-optimization", price: "10000", desc: "Optimized route calculation" },
    ];

    for (const ep of paidEndpoints) {
      test(`${ep.path} returns 402 without payment`, async () => {
        const res = await fetch(`${BASE}${ep.path}`);
        expect(res.status).toBe(402);
      });

      test(`${ep.path} 402 includes correct x402 requirements`, async () => {
        const res = await fetch(`${BASE}${ep.path}`);
        const body = await res.json();
        expect(body.x402).toBeDefined();
        expect(body.x402.version).toBe("1");
        expect(body.x402.price).toBe(ep.price);
        expect(body.x402.token).toBe("USDC");
        expect(body.x402.network).toBe("arc-testnet");
        expect(body.x402.recipient).toBe(RECIPIENT);
        expect(body.x402.description).toBe(ep.desc);
      });
    }
  });

  // 4. Paid endpoints return 200 with valid X-PAYMENT header
  describe("200 with valid payment", () => {
    test("/gas-prices returns data with valid payment", async () => {
      const header = makePaymentHeader("/gas-prices", "3000", RECIPIENT);
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.stations).toBeArray();
      expect(body.data.stations.length).toBe(5);
      expect(body.payment.accepted).toBe(true);
    });

    test("/restaurants returns data with valid payment", async () => {
      const header = makePaymentHeader("/restaurants", "5000", RECIPIENT);
      const res = await fetch(`${BASE}/restaurants`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.restaurants).toBeArray();
      expect(body.data.restaurants.length).toBe(5);
    });

    test("/weather returns data with valid payment", async () => {
      const header = makePaymentHeader("/weather", "2000", RECIPIENT);
      const res = await fetch(`${BASE}/weather`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.current).toBeDefined();
      expect(body.data.current.temp_c).toBeNumber();
      expect(body.data.hourly_forecast).toBeArray();
      expect(body.data.hourly_forecast.length).toBe(6);
    });

    test("/route-optimization returns data with valid payment", async () => {
      const header = makePaymentHeader("/route-optimization", "10000", RECIPIENT);
      const res = await fetch(`${BASE}/route-optimization`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.total_distance_km).toBeNumber();
      expect(body.data.estimated_time_min).toBeNumber();
      expect(body.data.waypoints).toBeArray();
      expect(body.data.traffic_status).toBeString();
    });
  });

  // 5. Stats endpoint tracks payments
  describe("GET /stats", () => {
    test("reflects payments made in previous tests", async () => {
      const res = await fetch(`${BASE}/stats`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.paymentCount).toBeGreaterThan(0);
      expect(body.totalAmount).toBeGreaterThan(0);
      expect(body.byEndpoint).toBeDefined();
    });
  });

  // 6. Structured mock data validation
  describe("Mock data structure", () => {
    test("gas station entries have required fields", async () => {
      const header = makePaymentHeader("/gas-prices", "3000", RECIPIENT);
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": header },
      });
      const body = await res.json();
      const station = body.data.stations[0];
      expect(station).toHaveProperty("name");
      expect(station).toHaveProperty("price_per_liter");
      expect(station).toHaveProperty("distance_km");
      expect(station).toHaveProperty("brand");
    });

    test("restaurant entries have required fields", async () => {
      const header = makePaymentHeader("/restaurants", "5000", RECIPIENT);
      const res = await fetch(`${BASE}/restaurants`, {
        headers: { "X-PAYMENT": header },
      });
      const body = await res.json();
      const restaurant = body.data.restaurants[0];
      expect(restaurant).toHaveProperty("name");
      expect(restaurant).toHaveProperty("cuisine");
      expect(restaurant).toHaveProperty("avg_price_eur");
      expect(restaurant).toHaveProperty("rating");
      expect(restaurant).toHaveProperty("distance_km");
    });

    test("weather data has required structure", async () => {
      const header = makePaymentHeader("/weather", "2000", RECIPIENT);
      const res = await fetch(`${BASE}/weather`, {
        headers: { "X-PAYMENT": header },
      });
      const body = await res.json();
      expect(body.data.current).toHaveProperty("temp_c");
      expect(body.data.current).toHaveProperty("conditions");
      expect(body.data.current).toHaveProperty("humidity_pct");
      expect(body.data.current).toHaveProperty("wind_kph");
      const forecast = body.data.hourly_forecast[0];
      expect(forecast).toHaveProperty("hour");
      expect(forecast).toHaveProperty("temp_c");
      expect(forecast).toHaveProperty("conditions");
    });

    test("route optimization has required structure", async () => {
      const header = makePaymentHeader("/route-optimization", "10000", RECIPIENT);
      const res = await fetch(`${BASE}/route-optimization`, {
        headers: { "X-PAYMENT": header },
      });
      const body = await res.json();
      expect(body.data).toHaveProperty("total_distance_km");
      expect(body.data).toHaveProperty("estimated_time_min");
      expect(body.data).toHaveProperty("waypoints");
      expect(body.data).toHaveProperty("traffic_status");
      expect(body.data).toHaveProperty("toll_cost_eur");
      const waypoint = body.data.waypoints[0];
      expect(waypoint).toHaveProperty("name");
      expect(waypoint).toHaveProperty("lat");
      expect(waypoint).toHaveProperty("lng");
      expect(waypoint).toHaveProperty("eta_min");
    });
  });

  // Edge cases
  describe("Error handling", () => {
    test("invalid base64 in X-PAYMENT returns 400", async () => {
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": "not-valid-base64!!!" },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("base64");
    });

    test("valid base64 but invalid JSON returns 400", async () => {
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": btoa("not json at all") },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("JSON");
    });

    test("missing 'from' field returns 400", async () => {
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: {
          "X-PAYMENT": btoa(JSON.stringify({ to: RECIPIENT, amount: "3000" })),
        },
      });
      expect(res.status).toBe(400);
    });

    test("wrong recipient returns 400", async () => {
      const header = makePaymentHeader("/gas-prices", "3000", "0xWrongRecipient");
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Recipient mismatch");
    });

    test("insufficient payment returns 400", async () => {
      const header = makePaymentHeader("/gas-prices", "1", RECIPIENT);
      const res = await fetch(`${BASE}/gas-prices`, {
        headers: { "X-PAYMENT": header },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Insufficient");
    });

    test("unknown path returns 404", async () => {
      const res = await fetch(`${BASE}/nonexistent`);
      expect(res.status).toBe(404);
    });
  });
});
