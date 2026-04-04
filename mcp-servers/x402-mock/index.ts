/**
 * x402 Mock API Server
 *
 * Simulates the x402 payment protocol (HTTP 402 "Payment Required")
 * for a hackathon demo. AI agents pay for data using signed EIP-3009
 * authorizations sent in the X-PAYMENT header.
 */

const PORT = Number(process.env.PORT) || 4402;
const RECIPIENT_ADDRESS =
  process.env.RECIPIENT_ADDRESS ||
  "0x0000000000000000000000000000000000000402";
const NETWORK = process.env.NETWORK || "arc-testnet";

// ---------------------------------------------------------------------------
// In-memory payment stats
// ---------------------------------------------------------------------------

interface PaymentStats {
  totalAmount: number;
  paymentCount: number;
  byEndpoint: Record<string, { amount: number; count: number }>;
}

const stats: PaymentStats = {
  totalAmount: 0,
  paymentCount: 0,
  byEndpoint: {},
};

function recordPayment(endpoint: string, amount: number) {
  stats.totalAmount += amount;
  stats.paymentCount += 1;
  if (!stats.byEndpoint[endpoint]) {
    stats.byEndpoint[endpoint] = { amount: 0, count: 0 };
  }
  stats.byEndpoint[endpoint].amount += amount;
  stats.byEndpoint[endpoint].count += 1;
  console.log(
    `[x402] Payment received: ${amount} USDC units for ${endpoint} (total: ${stats.paymentCount} payments, ${stats.totalAmount} units)`
  );
}

// ---------------------------------------------------------------------------
// Endpoint definitions (price in 6-decimal USDC units)
// ---------------------------------------------------------------------------

interface EndpointConfig {
  price: string;
  description: string;
  handler: () => unknown;
}

const ENDPOINTS: Record<string, EndpointConfig> = {
  "/gas-prices": {
    price: "3000",
    description: "Gas prices along route",
    handler: () => ({
      route: "Nice → Cannes",
      currency: "EUR",
      stations: [
        { name: "TotalEnergies Nice-Est", price_per_liter: 1.82, distance_km: 0, brand: "TotalEnergies" },
        { name: "Shell Cagnes-sur-Mer", price_per_liter: 1.79, distance_km: 8, brand: "Shell" },
        { name: "BP Villeneuve-Loubet", price_per_liter: 1.85, distance_km: 14, brand: "BP" },
        { name: "Esso Antibes", price_per_liter: 1.77, distance_km: 20, brand: "Esso" },
        { name: "TotalEnergies Cannes-Centre", price_per_liter: 1.84, distance_km: 33, brand: "TotalEnergies" },
      ],
    }),
  },

  "/restaurants": {
    price: "5000",
    description: "Restaurant recommendations along route",
    handler: () => ({
      route: "Nice → Cannes",
      restaurants: [
        { name: "Le Safari", cuisine: "Provençal", avg_price_eur: 28, rating: 4.3, distance_km: 2 },
        { name: "La Petite Maison", cuisine: "French Mediterranean", avg_price_eur: 45, rating: 4.7, distance_km: 3 },
        { name: "Chez Pipo", cuisine: "Niçoise / Street Food", avg_price_eur: 12, rating: 4.5, distance_km: 1 },
        { name: "L'Ondine", cuisine: "Seafood", avg_price_eur: 38, rating: 4.4, distance_km: 18 },
        { name: "La Table du Chef", cuisine: "Modern French", avg_price_eur: 55, rating: 4.8, distance_km: 30 },
      ],
    }),
  },

  "/weather": {
    price: "2000",
    description: "Weather forecast for route",
    handler: () => ({
      location: "Côte d'Azur",
      current: {
        temp_c: 22,
        conditions: "Partly Cloudy",
        humidity_pct: 58,
        wind_kph: 14,
      },
      hourly_forecast: [
        { hour: "+1h", temp_c: 22, conditions: "Partly Cloudy" },
        { hour: "+2h", temp_c: 23, conditions: "Sunny" },
        { hour: "+3h", temp_c: 24, conditions: "Sunny" },
        { hour: "+4h", temp_c: 23, conditions: "Sunny" },
        { hour: "+5h", temp_c: 22, conditions: "Partly Cloudy" },
        { hour: "+6h", temp_c: 20, conditions: "Clear" },
      ],
    }),
  },

  "/route-optimization": {
    price: "10000",
    description: "Optimized route calculation",
    handler: () => ({
      origin: "Nice",
      destination: "Cannes",
      total_distance_km: 33.4,
      estimated_time_min: 38,
      traffic_status: "moderate",
      waypoints: [
        { name: "Nice", lat: 43.7102, lng: 7.262, eta_min: 0 },
        { name: "Cagnes-sur-Mer", lat: 43.6637, lng: 7.1483, eta_min: 10 },
        { name: "Antibes", lat: 43.5804, lng: 7.1251, eta_min: 22 },
        { name: "Cannes", lat: 43.5528, lng: 7.0174, eta_min: 38 },
      ],
      toll_cost_eur: 2.6,
      fuel_estimate_eur: 3.1,
    }),
  },
};

// ---------------------------------------------------------------------------
// Payment validation
// ---------------------------------------------------------------------------

interface PaymentPayload {
  from: string;
  to: string;
  amount: string;
  network: string;
  token: string;
  endpoint: string;
  timestamp: number;
}

function validatePayment(
  header: string,
  expectedAmount: string,
  expectedEndpoint: string
): { valid: true; payload: PaymentPayload } | { valid: false; error: string } {
  let decoded: string;
  try {
    decoded = atob(header);
  } catch {
    return { valid: false, error: "X-PAYMENT header is not valid base64" };
  }

  let payload: PaymentPayload;
  try {
    payload = JSON.parse(decoded);
  } catch {
    return { valid: false, error: "X-PAYMENT header is not valid JSON" };
  }

  // Structural validation — just check the required fields exist
  if (!payload.from || typeof payload.from !== "string") {
    return { valid: false, error: "Missing or invalid 'from' field" };
  }
  if (!payload.to || typeof payload.to !== "string") {
    return { valid: false, error: "Missing or invalid 'to' field" };
  }
  if (!payload.amount || typeof payload.amount !== "string") {
    return { valid: false, error: "Missing or invalid 'amount' field" };
  }

  // Check recipient matches
  if (payload.to.toLowerCase() !== RECIPIENT_ADDRESS.toLowerCase()) {
    return {
      valid: false,
      error: `Recipient mismatch: expected ${RECIPIENT_ADDRESS}, got ${payload.to}`,
    };
  }

  // Check amount is sufficient
  if (Number(payload.amount) < Number(expectedAmount)) {
    return {
      valid: false,
      error: `Insufficient payment: expected at least ${expectedAmount}, got ${payload.amount}`,
    };
  }

  return { valid: true, payload };
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "X-PAYMENT, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      ...headers,
    },
  });
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return jsonResponse(null, 204);
    }

    // --- Free endpoints ---

    if (path === "/health") {
      return jsonResponse({ status: "ok", protocol: "x402-mock", version: "0.1.0" });
    }

    if (path === "/stats") {
      return jsonResponse({
        totalAmount: stats.totalAmount,
        paymentCount: stats.paymentCount,
        byEndpoint: stats.byEndpoint,
      });
    }

    // --- Paid endpoints ---

    const endpointConfig = ENDPOINTS[path];
    if (!endpointConfig) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const paymentHeader = req.headers.get("X-PAYMENT");

    // No payment → 402
    if (!paymentHeader) {
      return jsonResponse(
        {
          x402: {
            version: "1",
            price: endpointConfig.price,
            token: "USDC",
            network: NETWORK,
            recipient: RECIPIENT_ADDRESS,
            description: endpointConfig.description,
          },
        },
        402
      );
    }

    // Validate payment
    const result = validatePayment(paymentHeader, endpointConfig.price, path);

    if (!result.valid) {
      return jsonResponse({ error: result.error }, 400);
    }

    // Payment accepted — record and serve data
    recordPayment(path, Number(endpointConfig.price));

    return jsonResponse({
      data: endpointConfig.handler(),
      payment: {
        accepted: true,
        amount: endpointConfig.price,
        token: "USDC",
        network: NETWORK,
      },
    });
  },
});

console.log(`
╔══════════════════════════════════════════════════════╗
║           x402 Mock Payment Server                   ║
║                                                      ║
║  Port:      ${String(PORT).padEnd(39)}║
║  Recipient: ${RECIPIENT_ADDRESS.slice(0, 10)}...${RECIPIENT_ADDRESS.slice(-4)}                          ║
║  Network:   ${NETWORK.padEnd(39)}║
║                                                      ║
║  Endpoints:                                          ║
║    GET /gas-prices          $0.003                    ║
║    GET /restaurants         $0.005                    ║
║    GET /weather             $0.002                    ║
║    GET /route-optimization  $0.010                    ║
║    GET /health              free                      ║
║    GET /stats               free                      ║
╚══════════════════════════════════════════════════════╝
`);

export { server, stats };
