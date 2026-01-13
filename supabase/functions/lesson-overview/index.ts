
// supabase/functions/lesson-overview/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/** ---------------- CORS ---------------- */
function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  const cors = buildCorsHeaders(req);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** ---------------- Types ---------------- */
type Tone = "simple" | "standard" | "detailed";

type LessonOverviewRequest = {
  title?: string;
  objectives?: string[];
  tone?: Tone;
};

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type ChatCompletionsResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

/** ---------------- Helpers: Base64URL ---------------- */
function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlFromString(s: string): string {
  return base64UrlFromBytes(new TextEncoder().encode(s));
}

/** ---------------- Google Auth: Service Account JWT -> Access Token ---------------- */
function pemToPkcs8DerBytes(pem: string): Uint8Array {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\r?\n/g, "")
    .trim();

  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function importServiceAccountKey(privateKeyPem: string): Promise<CryptoKey> {
  const pkcs8Bytes = pemToPkcs8DerBytes(privateKeyPem);

  // ✅ Force a plain ArrayBuffer (not ArrayBufferLike / SharedArrayBuffer)
  const pkcs8 = new ArrayBuffer(pkcs8Bytes.byteLength);
  new Uint8Array(pkcs8).set(pkcs8Bytes);

  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8, // ✅ ArrayBuffer is a valid BufferSource
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}


async function signJwtRS256(privateKey: CryptoKey, header: unknown, payload: unknown): Promise<string> {
  const encHeader = base64UrlFromString(JSON.stringify(header));
  const encPayload = base64UrlFromString(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(toSign),
  );

  const sigB64Url = base64UrlFromBytes(new Uint8Array(sig));
  return `${toSign}.${sigB64Url}`;
}

async function getGoogleAccessToken(sa: GoogleServiceAccount): Promise<string> {
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const key = await importServiceAccountKey(sa.private_key);
  const assertion = await signJwtRS256(key, header, payload);

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", assertion);

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Google OAuth token request failed (${resp.status}): ${t}`);
  }

  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google OAuth response missing access_token");
  return data.access_token;
}

/** ---------------- Prompt ---------------- */
function buildPrompt(title: string, objectives: string[], tone: Tone): string {
  const obj = objectives.length ? objectives.map((o) => `- ${o}`).join("\n") : "(none)";
  const lengthGuide =
    tone === "simple" ? "80-120 words" : tone === "detailed" ? "up to 250 words" : "120-180 words";

  return `
You write lesson overviews for teachers.
Keep it classroom-ready, clear, and age-appropriate.
Return ONLY the overview text (no headings).

Lesson title: ${title}

Objectives:
${obj}

Tone: ${tone}

Write a concise overview describing what the lesson is about, how it flows, and what students will achieve.
Target length: ${lengthGuide}.
`.trim();
}

/** ---------------- Main ---------------- */
serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  // Require logged-in users
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(req, { error: "Missing authorization header" }, 401);
  }

  // Secrets
  const projectId = Deno.env.get("GCP_PROJECT_ID") ?? "";
  const location = Deno.env.get("GCP_LOCATION") ?? "us-central1";
  const model = Deno.env.get("VERTEX_OPENAI_MODEL") ?? "google/gemini-2.0-flash-001";
  const saJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ?? "";

  if (!projectId) return json(req, { error: "Missing GCP_PROJECT_ID" }, 500);
  if (!saJson) return json(req, { error: "Missing GCP_SERVICE_ACCOUNT_JSON" }, 500);

  let body: LessonOverviewRequest;
  try {
    body = (await req.json()) as LessonOverviewRequest;
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const title = String(body.title ?? "").trim();
  const objectives = Array.isArray(body.objectives) ? body.objectives.map((x) => String(x)) : [];
  const tone: Tone = body.tone ?? "standard";

  if (title.length < 3) return json(req, { error: "Title is required" }, 400);

  let sa: GoogleServiceAccount;
  try {
    sa = JSON.parse(saJson) as GoogleServiceAccount;
  } catch {
    return json(req, { error: "GCP_SERVICE_ACCOUNT_JSON is not valid JSON" }, 500);
  }

  try {
    // 1) Google OAuth token
    const accessToken = await getGoogleAccessToken(sa);

    // 2) Vertex AI OpenAI-compatible endpoint
    const url =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;

    const prompt = buildPrompt(title, objectives, tone);
    const temperature = tone === "simple" ? 0.5 : tone === "detailed" ? 0.8 : 0.7;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(req, { error: "Vertex AI request failed", status: resp.status, detail: t }, 500);
    }

    const data = (await resp.json()) as ChatCompletionsResponse;
    const overview = String(data.choices?.[0]?.message?.content ?? "").trim();

    if (!overview) {
      return json(req, { error: "No overview returned by model" }, 500);
    }

    return json(req, { overview }, 200);
  } catch (err: unknown) {
    console.error("lesson-overview error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json(req, { error: "Server error", detail: msg }, 500);
  }
});