import http from "node:http";

const PORT = 3456;

const routes: Record<string, (req: http.IncomingMessage) => { status: number; body: unknown }> = {
  "GET /": () => ({
    status: 200,
    body: { message: "Welcome to the mock server", version: "1.0.0" },
  }),

  "GET /health": () => ({
    status: 200,
    body: { status: "ok", uptime: process.uptime() },
  }),

  "GET /users": () => ({
    status: 200,
    body: [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Charlie", email: "charlie@example.com" },
    ],
  }),

  "GET /users/1": () => ({
    status: 200,
    body: { id: 1, name: "Alice", email: "alice@example.com" },
  }),

  "POST /users": () => ({
    status: 201,
    body: { id: 4, name: "New User", message: "User created" },
  }),

  "GET /posts": () => ({
    status: 200,
    body: [
      { id: 1, title: "Hello World", author: "Alice" },
      { id: 2, title: "Mock Data", author: "Bob" },
    ],
  }),
};

const server = http.createServer((req, res) => {
  const key = `${req.method} ${req.url}`;
  const handler = routes[key];

  res.setHeader("Content-Type", "application/json");

  if (handler) {
    const { status, body } = handler(req);
    res.writeHead(status);
    res.end(JSON.stringify(body, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
  }

  console.log(`${req.method} ${req.url} -> ${res.statusCode}`);
});

server.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
  console.log("Routes:", Object.keys(routes).join(", "));
});
