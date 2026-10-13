// worker.js
var ORIGINS = ["https://appleflash.github.io", "http://localhost:8000"];
var worker_default = {
  async fetch(req, env) {
    const origin = req.headers.get("Origin");
    if (!ORIGINS.includes(origin)) return new Response("Forbidden", { status: 403 });
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    const body = await req.text();
    let res;
    for (const model of ["gemini-flash-lite-latest", "gemini-flash-latest"]) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
        body
      });
      if (res.status !== 429 && res.status !== 503) break;
    }
    return new Response(res.body, { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
