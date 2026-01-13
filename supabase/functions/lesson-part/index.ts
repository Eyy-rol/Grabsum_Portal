// supabase/functions/lesson-part/index.ts
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
type LessonPartRequest = {
  lessonTitle?: string;
  subject?: string;
  gradeLevel?: string;
  section?: string;
  objectives?: string[];
  partType?: string;   // e.g., "Warm-up"
  partTitle?: string;  // teacher editable title
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
  const pkcs8 = new ArrayBuffer(pkcs8Bytes.byteLength);
  new Uint8Array(pkcs8).set(pkcs8Bytes);

  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
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

/** ---------------- Prompt (Student-facing, PH Senior High) ---------------- */

function partGuidance(partType: string): string {
  const t = partType.toLowerCase();

  if (t.includes("warm"))
    return "Write a short warm-up for Senior High School students in the Philippines (3–7 minutes). Use clear instructions and 2–4 engaging questions or tasks.";

  if (t.includes("direct instruction"))
    return "Explain the lesson concept clearly to Senior High School students using simple language, short steps, and relevant examples.";

  if (t.includes("guided"))
    return "Write guided practice for students: step-by-step tasks, guide questions, and helpful hints (no teacher instructions).";

  if (t.includes("independent"))
    return "Write independent practice for students: clear directions, tasks, and expected outputs they can complete on their own.";

  if (t.includes("assessment"))
    return "Write a short student-facing assessment (exit ticket or short quiz). Do NOT include answers.";

  if (t.includes("homework"))
    return "Write student-facing homework directions with clear tasks and submission expectations.";

  if (t.includes("materials"))
    return "List materials students need (student-facing). Keep it simple and practical.";

  if (t.includes("notes"))
    return "Write student notes: key reminders, study tips, important points, and common mistakes to avoid.";

  if (t.includes("discussion"))
    return "Write student-facing discussion prompts and simple participation rules (respectful responses, listening, evidence-based answers).";

  if (t.includes("overview"))
    return "Write a student-friendly lesson overview explaining what you will learn, what you will do, and what you should understand by the end.";

  return "Write student-facing content appropriate for Senior High School students in the Philippines.";
}

function buildPrompt(req: {
  lessonTitle: string;
  subject: string;
  gradeLevel: string;
  section?: string;
  objectives: string[];
  partType: string;
  partTitle: string;
}): string {
  const obj = req.objectives.length ? req.objectives.map((o) => `- ${o}`).join("\n") : "(none)";
  const sectionLine = req.section?.trim() ? `Section: ${req.section.trim()}\n` : "";

  return `
You are generating lesson content that will be shown directly to students.

Target learners:
- Senior High School students (Grades 11–12)
- Philippine school context
- Student-facing only (NOT teacher instructions)

Writing rules:
- Write directly to students using "you".
- Use clear, respectful, and encouraging language.
- Keep sentences short and easy to understand.
- Avoid teacher instructions (no "teacher will", "discuss with students", "check for understanding", etc.).
- Avoid personal names and sensitive information.
- You MAY use bullets or numbered steps.
- DO NOT include headings like "Warm-up:" or markdown titles.

Lesson Information:
Lesson Title: ${req.lessonTitle}
Subject: ${req.subject}
Grade Level: Senior High School (${req.gradeLevel})
${sectionLine}
Learning Objectives (what you should be able to do):
${obj}

Lesson Part:
Type: ${req.partType}
Title: ${req.partTitle}

Part-specific instruction:
- ${partGuidance(req.partType)}

Now write the student-facing content:
`.trim();
}

/** ---------------- Main ---------------- */

serve(async (req: Request) => {
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

  let body: LessonPartRequest;
  try {
    body = (await req.json()) as LessonPartRequest;
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const lessonTitle = String(body.lessonTitle ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const gradeLevel = String(body.gradeLevel ?? "").trim(); // can be "Grade 11" or "Grade 12"
  const section = String(body.section ?? "").trim();
  const objectives = Array.isArray(body.objectives) ? body.objectives.map((x) => String(x)) : [];
  const partType = String(body.partType ?? "").trim();
  const partTitle = String(body.partTitle ?? partType).trim();

  if (lessonTitle.length < 3) return json(req, { error: "lessonTitle is required" }, 400);
  if (subject.length < 2) return json(req, { error: "subject is required" }, 400);
  if (!gradeLevel) return json(req, { error: "gradeLevel is required" }, 400);
  if (!partType) return json(req, { error: "partType is required" }, 400);

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

    const prompt = buildPrompt({
      lessonTitle,
      subject,
      gradeLevel,
      section: section || undefined,
      objectives,
      partType,
      partTitle: partTitle || partType,
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(req, { error: "Vertex AI request failed", status: resp.status, detail: t }, 500);
    }

    const data = (await resp.json()) as ChatCompletionsResponse;
    const content = String(data.choices?.[0]?.message?.content ?? "").trim();

    if (!content) return json(req, { error: "No content returned by model" }, 500);

    return json(req, { content }, 200);
  } catch (err: unknown) {
    console.error("lesson-part error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json(req, { error: "Server error", detail: msg }, 500);
  }
});
