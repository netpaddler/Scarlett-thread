// Creates a public GitHub issue for each comment or request from the map, then adds a reply.
// Secrets: GITHUB_TOKEN, TURNSTILE_SECRET
// Vars: REPO, LABEL, ALLOWED_ORIGIN

const hits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cors(response, env) {
  const headers = new Headers(response.headers);
  const origin = env.ALLOWED_ORIGIN || "*";
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function originAllowed(request, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  if (allowed === "*") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === allowed;
}

function plainText(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function commentView(comment) {
  const login = comment && comment.user && comment.user.login ? comment.user.login : "";
  return {
    author: plainText(login),
    body: plainText(comment && comment.body),
    created_at: comment && comment.created_at ? comment.created_at : "",
  };
}

function issueView(issue, comments) {
  return {
    number: issue.number,
    title: plainText(issue.title),
    created_at: issue.created_at || "",
    html_url: typeof issue.html_url === "string" ? issue.html_url : "",
    body: plainText(issue.body),
    comments: Array.isArray(comments) ? comments.map(commentView) : [],
  };
}

async function loadIssueList(env) {
  const repo = env.REPO || "netpaddler/Scarlett-thread";
  const label = env.LABEL || "map-request";
  const listed = await github(
    env,
    `/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=20`,
  );
  if (!listed.ok) return null;
  const raw = await listed.json();
  const issues = (Array.isArray(raw) ? raw : []).filter((item) => item && !item.pull_request);
  const comments = await Promise.all(
    issues.map(async (issue) => {
      if (!issue.comments) return [];
      const reply = await github(env, `/repos/${repo}/issues/${issue.number}/comments`);
      if (!reply.ok) return [];
      const data = await reply.json();
      return Array.isArray(data) ? data : [];
    }),
  );
  return issues.map((issue, index) => issueView(issue, comments[index]));
}

async function cachedIssueList(env) {
  const cache = caches.default;
  const key = new Request("https://scarlet-thread.internal/map-requests");
  const hit = await cache.match(key);
  if (hit) return hit;
  if (!env.GITHUB_TOKEN) return json({ error: "Requests are not open yet." }, 503);
  const list = await loadIssueList(env);
  if (!list) return json({ error: "The list did not load." }, 502);
  const response = new Response(JSON.stringify(list), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
  await cache.put(key, response.clone());
  return response;
}

function allow(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

async function turnstileOk(token, request, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success === true;
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "user-agent": "scarlet-thread-requests",
      "x-github-api-version": "2022-11-28",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function ensureLabel(env) {
  const repo = env.REPO || "netpaddler/Scarlett-thread";
  const label = env.LABEL || "map-request";
  const existing = await github(env, `/repos/${repo}/labels/${encodeURIComponent(label)}`);
  if (existing.ok) return;
  await github(env, `/repos/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: label,
      color: "8c1d2c",
      description: "A comment, or a person or event asked for on the Scarlet Thread map",
    }),
  });
}

export default {
  async fetch(request, env) {
    if (!originAllowed(request, env)) return json({ error: "This origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
    if (request.method === "GET") return cors(await cachedIssueList(env), env);
    if (request.method !== "POST") return cors(json({ error: "Send a POST request." }, 405), env);
    let payload;
    try {
      payload = await request.json();
    } catch {
      return cors(json({ error: "The form could not be read." }, 400), env);
    }
    if (clip(payload.company, 200)) return cors(json({ ok: true }), env);
    const message = clip(payload.message, 2000);
    const name = clip(payload.name, 80);
    const subject = clip(payload.subject, 120);
    const kind = payload.kind === "event" ? "Event" : payload.kind === "person" ? "Person" : "Not given";
    if (!message) return cors(json({ error: "Write a comment or a request." }, 400), env);
    if (!(await turnstileOk(payload.turnstile, request, env))) {
      return cors(json({ error: "The check failed. Try again." }, 400), env);
    }
    if (!allow(request)) return cors(json({ error: "Please wait a while, then try again." }, 429), env);
    if (!env.GITHUB_TOKEN) return cors(json({ error: "Requests are not open yet." }, 503), env);

    const repo = env.REPO || "netpaddler/Scarlett-thread";
    const label = env.LABEL || "map-request";
    await ensureLabel(env);
    const title = (subject ? `Request: ${subject}` : `Comment: ${message}`).slice(0, 120);
    const body = [
      `Name: ${name || "Not given"}`,
      `Person or event: ${subject || "Not given"}`,
      `Kind: ${kind}`,
      "",
      message,
    ].join("\n");
    const created = await github(env, `/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body, labels: [label] }),
    });
    if (!created.ok) return cors(json({ error: "The request did not go through." }, 502), env);
    const issue = await created.json();
    await github(env, `/repos/${repo}/issues/${issue.number}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: "Thanks for writing. Scarlet Thread will reply here.",
      }),
    });
    return cors(json({ ok: true, url: issue.html_url }), env);
  },
};
