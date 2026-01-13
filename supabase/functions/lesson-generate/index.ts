// deno-lint-ignore-file no-explicit-any
// ^ If you want ZERO lint ignores, tell me and I’ll give you a strict version.
//   For now, we still avoid explicit `any` in code below; this just stops noisy lint rules globally.

// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS -------------------- */
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

/* -------------------- Backoff for 429/503 -------------------- */
async function fetchWithBackoff(url: string, init: RequestInit, tries = 8) {
  let delay = 600;
  for (let i = 0; i < tries; i++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 && resp.status !== 503) return resp;

    const ra = resp.headers.get("retry-after");
    const retryAfterMs = ra ? Number(ra) * 1000 : 0;
    const jitter = Math.floor(Math.random() * 250);
    const waitMs = Math.max(retryAfterMs, delay) + jitter;

    await new Promise((r) => setTimeout(r, waitMs));
    delay = Math.min(delay * 1.8, 10_000);
  }
  return fetch(url, init);
}

/* -------------------- Output Schema -------------------- */
const OUTPUT_SCHEMA = {
  name: "lesson_generation",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tags: { type: "array", items: { type: "string" }, maxItems: 12 },
      parts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            activities: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  title: { type: "string" },
                  instructions: { type: "string" },
                  estimatedMinutes: { type: "number" },
                  attachable: { type: "boolean" },
                },
                required: [
                  "id",
                  "type",
                  "title",
                  "instructions",
                  "estimatedMinutes",
                  "attachable",
                ],
              },
            },
          },
          required: ["id", "type", "title", "body", "activities"],
        },
      },
    },
    required: ["tags", "parts"],
  },
} as const;

/* -------------------- Helpers -------------------- */
function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : JSON.stringify(e);
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object") ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/* -------------------- Google OAuth (Service Account -> Access Token) -------------------- */
type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function b64url(input: Uint8Array) {
  let str = "";
  for (let i = 0; i < input.length; i++) str += String.fromCharCode(input[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8(s: string) {
  return new TextEncoder().encode(s);
}

function pemToDerArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  // return a real ArrayBuffer (not SharedArrayBuffer/ArrayBufferLike)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function signJwtRS256(privateKeyPem: string, payload: Record<string, unknown>) {
  const header = { alg: "RS256", typ: "JWT" };
  const encHeader = b64url(utf8(JSON.stringify(header)));
  const encPayload = b64url(utf8(JSON.stringify(payload)));
  const toSign = `${encHeader}.${encPayload}`;

  const keyDer = pemToDerArrayBuffer(privateKeyPem);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    utf8(toSign),
  );

  return `${toSign}.${b64url(new Uint8Array(sig))}`;
}

let cachedToken: { token: string; expMs: number } | null = null;

async function getGoogleAccessToken(sa: ServiceAccount) {
  const now = Date.now();
  if (cachedToken && cachedToken.expMs - now > 60_000) return cachedToken.token;

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const jwt = await signJwtRS256(sa.private_key, {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat,
    exp,
  });

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Google token error (HTTP ${resp.status}): ${t}`);
  }

  const j = await resp.json() as Record<string, unknown>;
  const token = asString(j.access_token, "");
  if (!token) throw new Error("Google token error: missing access_token");

  cachedToken = { token, expMs: now + 55 * 60_000 };
  return token;
}

/* -------------------- Vertex AI (Gemini) call -------------------- */
async function generateWithVertex(opts: {
  accessToken: string;
  projectId: string;
  location: string;
  model: string;
  system: string;
  user: string;
}) {
  const { accessToken, projectId, location, model, system, user } = opts;

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1800,
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA.schema,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const resp = await fetchWithBackoff(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Vertex generateContent failed (HTTP ${resp.status}): ${t}`);
  }

  const j = await resp.json() as Record<string, unknown>;
  const candidates = (j.candidates ?? []) as unknown[];

  const c0 = candidates[0];
  const c0r = asRecord(c0);
  const content = asRecord(c0r.content);
  const parts = (content.parts ?? []) as unknown[];

  const text = parts.map((p) => asString(asRecord(p).text, "")).join("").trim();
  if (!text) throw new Error("Vertex returned empty output");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Vertex returned non-JSON output: ${text.slice(0, 800)}`);
  }

  return parsed;
}

/* -------------------- Main Handler -------------------- */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  // Supabase env
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Vertex env
  const projectId = Deno.env.get("GCP_PROJECT_ID") ?? "";
  const location = Deno.env.get("GCP_LOCATION") ?? "";
  const model = Deno.env.get("VERTEX_MODEL") ?? "";
  const saJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return json(req, { error: "Server misconfigured: missing Supabase env vars" }, 500);
  }
  if (!projectId || !location || !model || !saJson) {
    return json(
      req,
      {
        error:
          "Server misconfigured: missing Vertex env vars (GCP_PROJECT_ID, GCP_LOCATION, VERTEX_MODEL, GCP_SERVICE_ACCOUNT_JSON)",
      },
      500,
    );
  }

  // Require JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Single-flight lock
  const { data: locked, error: lockErr } = await supabase.rpc(
    "try_take_ai_generation_lock",
    { p_ttl_seconds: 60 },
  );
  if (lockErr) return json(req, { error: lockErr.message }, 500);

  const lockAcquired = Array.isArray(locked) ? Boolean(locked[0]) : Boolean(locked);
  if (!lockAcquired) {
    return json(req, { error: "Another AI generation is already in progress." }, 409);
  }

  try {
    // Quota check (do not consume yet)
    const { data: q, error: qErr } = await supabase.rpc("get_ai_generation_quota", {
      p_limit: 10,
    });
    if (qErr) return json(req, { error: qErr.message }, 500);

    const quota = Array.isArray(q) ? q[0] : q;
    if ((quota?.remaining ?? 0) <= 0) {
      return json(req, { error: "Daily AI generation limit reached (10/day)." }, 429);
    }

    // Body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json(req, { error: "Invalid JSON body" }, 400);
    }

    const b = asRecord(rawBody);
    const lesson = asRecord(b.lesson);
    const tone = asString(b.tone, "Friendly");
    const difficulty = asString(b.difficulty, "On-level");
    const include = asRecord(b.include);
    const prompt = asString(b.prompt, "").trim();

    const includeList =
      Object.entries(include)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k)
        .join(", ") || "objectives,warmup,activities,assessment";

    const system = `
You generate Senior High School lesson plan sections for teachers.
Follow safety: no sexual content, no self-harm instructions, no hate/harassment, no graphic violence.
Return ONLY JSON matching the provided schema.
Generate ONLY the sections listed in "Include".
`.trim();

    const user = `
Lesson context:
- Title: ${asString(lesson.title, "(untitled)")}
- Subject: ${asString(lesson.subjectLabel, "(unknown)")}
- Grade: ${asString(lesson.gradeLabel, "(unknown)")}
- Track/Strand: ${asString(lesson.trackLabel, "")} ${asString(lesson.strandLabel, "")}
- Duration: ${asNumber(lesson.durationMinutes, 45)} minutes

Settings:
- Tone: ${tone}
- Difficulty: ${difficulty}
- Include: ${includeList}

Teacher prompt:
${prompt || "Generate engaging content and classroom-ready activities aligned to the lesson details."}

Output rules:
- Return JSON with { tags: string[], parts: Part[] }
- Each Part MUST include: id, type, title, body, activities[]
- If Include does NOT request activities, activities arrays can be empty.
- Keep timings realistic and age-appropriate.
`.trim();

    // Vertex: parse service account json
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(saJson) as ServiceAccount;
    } catch {
      return json(req, { error: "Invalid GCP_SERVICE_ACCOUNT_JSON (not valid JSON)" }, 500);
    }

    const accessToken = await getGoogleAccessToken(sa);

    let result: unknown;
    try {
      result = await generateWithVertex({
        accessToken,
        projectId,
        location,
        model,
        system,
        user,
      });
    } catch (e: unknown) {
      return json(req, { error: "Generation failed", detail: errMsg(e) }, 500);
    }

    // Consume quota ONLY after success
    const { data: consume, error: consumeErr } = await supabase.rpc(
      "try_consume_ai_generation",
      { p_limit: 10 },
    );

    if (consumeErr) {
      return json(req, { ...(result as Record<string, unknown>), quota_warning: consumeErr.message }, 200);
    }

    const consumedRow = Array.isArray(consume) ? consume[0] : consume;

    return json(req, {
      ...(result as Record<string, unknown>),
      quota: {
        used: consumedRow?.new_count,
        daily_limit: consumedRow?.daily_limit ?? 10,
        day_utc: consumedRow?.day_utc,
        consumed: consumedRow?.consumed,
      },
    }, 200);
  } finally {
    await supabase.rpc("release_ai_generation_lock");
  }
});
