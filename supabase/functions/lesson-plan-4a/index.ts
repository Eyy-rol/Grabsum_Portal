// supabase/functions/lesson-plan-4a/index.ts
// Generates a full 4A lesson plan JSON (lesson + parts + activities)
// - Enforces 10 AI assists/day using consume_ai_assist
// - Calls Vertex AI (Gemini) via OpenAI-compatible endpoint
// - Includes JSON repair pass if model output is invalid (no extra quota consumption)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type LessonPlan4ARequest = {
  title?: string;
  subject?: string;
  grade_level?: string | number;
  track?: string;
  strand?: string;
  tone?: Tone;
  duration_minutes?: number;
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

type ConsumeAssistRow = {
  allowed: boolean;
  remaining: number;
  used: number;
};

type LessonPayload = {
  lesson: {
    lesson_id: string; // keep "" for new
    title: string;
    subject_id: string;
    grade_id: string;
    track_id: string;
    strand_id: string;
    duration_minutes: number;
    audience: "Whole Class" | "Small Group" | "1:1";
    status: "Draft" | "Published" | "Archived";
  };
  parts: Array<{
    client_key: string;
    sort_order: number;
    part_type: string;
    title: string;
    body: string;
    is_collapsed: boolean;
  }>;
  activities: Array<{
    part_client_key: string;
    sort_order: number;
    activity_type: string;
    title: string;
    instructions: string;
    estimated_minutes: number;
    attachable: boolean;
  }>;
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

/** ---------------- Supabase Auth + Quota ---------------- */
async function getAuthedSupabase(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Missing SUPABASE_ANON_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { supabase: null, user: null, error: "Missing authorization header" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase: null, user: null, error: "Unauthorized" };
  }

  return { supabase, user: data.user, error: null };
}

async function consumeAssist(supabase: any, userId: string): Promise<ConsumeAssistRow> {
  const { data, error } = await supabase.rpc("consume_ai_assist", { p_user: userId });

  if (error) throw new Error(`consume_ai_assist failed: ${error.message}`);

  const row = Array.isArray(data) ? data?.[0] : data;

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("consume_ai_assist returned unexpected shape");
  }

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    used: Number(row.used ?? 0),
  };
}

/** ---------------- Prompt ---------------- */
function buildPlanPrompt(input: {
  title: string;
  subject: string;
  gradeLevel: string;
  track: string;
  strand: string;
  tone: Tone;
  durationMinutes: number;
}): string {
  const { title, subject, gradeLevel, track, strand, tone, durationMinutes } = input;

  const detailRules =
    tone === "simple"
      ? `- Keep bodies short.\n- Use fewer guide questions.\n- Keep instructions brief.`
      : tone === "detailed"
      ? `- Include more teacher prompts.\n- Include more guide questions.\n- Add clear success criteria.`
      : `- Balanced detail.\n- Clear instructions and examples.`;

  return `
You are an expert teacher who writes SHS lesson plans using the 4A model (Activity, Analysis, Abstraction, Application).

Return ONLY valid JSON. Do not add markdown fences. Do not add explanations.

Generate a lesson plan using THIS EXACT JSON SHAPE:
{
  "lesson": {
    "lesson_id": "",
    "title": "...",
    "subject_id": "",
    "grade_id": "",
    "track_id": "",
    "strand_id": "",
    "duration_minutes": ${durationMinutes},
    "audience": "Whole Class",
    "status": "Draft"
  },
  "parts": [
    { "client_key": "...", "sort_order": 1, "part_type": "...", "title": "...", "body": "...", "is_collapsed": false }
  ],
  "activities": [
    { "part_client_key": "...", "sort_order": 1, "activity_type": "...", "title": "...", "instructions": "...", "estimated_minutes": 5, "attachable": false }
  ]
}

REQUIREMENTS:
1) The parts MUST be in this order and have these exact client_key values:
   1. client_key="part-overview"        part_type="Overview"         title="Lesson Overview"
   2. client_key="part-objectives"      part_type="Objectives"       title="Learning Objectives"
   3. client_key="part-materials"       part_type="Materials"        title="Materials & Resources"
   4. client_key="part-4a-activity"     part_type="4A-Activity"      title="Activity"
   5. client_key="part-4a-analysis"     part_type="4A-Analysis"      title="Analysis"
   6. client_key="part-4a-abstraction"  part_type="4A-Abstraction"   title="Abstraction"
   7. client_key="part-4a-application"  part_type="4A-Application"   title="Application"
   8. client_key="part-assessment"      part_type="Assessment"       title="Assessment / Evidence of Learning"
   9. client_key="part-extension"       part_type="Extension"        title="Assignment / Enrichment"
   10. client_key="part-reflection"     part_type="Reflection"       title="Teacher Reflection"

2) Each part must have a meaningful "body" that fits the lesson context.
   - Use short paragraphs and bullet lists separated by "\\n".
   - Keep it grade-appropriate and aligned to the subject and strand/track.
   - The "Lesson Overview" body should mention flow across 4A.

3) Activities:
   - Provide activities ONLY for the 4A parts:
     part-4a-activity, part-4a-analysis, part-4a-abstraction, part-4a-application
   - Each 4A part must have 3–5 activities.
   - For each activity: fill activity_type, title, instructions, estimated_minutes, attachable.
   - sort_order resets per part starting at 1.
   - estimated_minutes must be integers.
   - Total minutes across ALL 4A activities should be close to duration_minutes (${durationMinutes}), within ±10 minutes.

4) Content rules:
   - No sensitive personal data.
   - No references to specific copyrighted textbook passages.
   - Use classroom-safe examples.

5) Tone / detail level:
${detailRules}

INPUT CONTEXT:
- Lesson Title: "${title}"
- Subject: "${subject}"
- Grade Level: "${gradeLevel}"
- Track: "${track}"
- Strand: "${strand}"

Now generate the JSON lesson plan.
`.trim();
}

/** ---------------- Model calling + JSON parsing ---------------- */
async function callVertexChat(args: {
  accessToken: string;
  projectId: string;
  location: string;
  model: string;
  prompt: string;
  temperature: number;
}): Promise<string> {
  const { accessToken, projectId, location, model, prompt, temperature } = args;

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;

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
    throw new Error(`Vertex AI request failed (${resp.status}): ${t}`);
  }

  const data = (await resp.json()) as ChatCompletionsResponse;
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

function safeParseJson(text: string): any | null {
  // Sometimes the model includes leading/trailing junk; try to extract first JSON object
  const trimmed = text.trim();

  // direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // try to extract from first "{" to last "}"
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const slice = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validatePlanShape(obj: any): obj is LessonPayload {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.lesson || typeof obj.lesson !== "object") return false;
  if (!Array.isArray(obj.parts) || !Array.isArray(obj.activities)) return false;

  // Minimal required fields
  if (typeof obj.lesson.title !== "string") return false;

  // Parts require client_key + sort_order
  for (const p of obj.parts) {
    if (!p || typeof p !== "object") return false;
    if (typeof p.client_key !== "string") return false;
    if (typeof p.sort_order !== "number") return false;
    if (typeof p.part_type !== "string") return false;
    if (typeof p.title !== "string") return false;
    if (typeof p.body !== "string") return false;
    if (typeof p.is_collapsed !== "boolean") return false;
  }

  // Activities require part_client_key + sort_order
  for (const a of obj.activities) {
    if (!a || typeof a !== "object") return false;
    if (typeof a.part_client_key !== "string") return false;
    if (typeof a.sort_order !== "number") return false;
    if (typeof a.activity_type !== "string") return false;
    if (typeof a.title !== "string") return false;
    if (typeof a.instructions !== "string") return false;
    if (typeof a.estimated_minutes !== "number") return false;
    if (typeof a.attachable !== "boolean") return false;
  }

  return true;
}

/** ---------------- Main ---------------- */
serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: buildCorsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  // Auth
  const authed = await getAuthedSupabase(req);
  if (authed.error || !authed.supabase || !authed.user) {
    return json(req, { error: authed.error || "Unauthorized" }, 401);
  }

  // Vertex secrets
  const projectId = Deno.env.get("GCP_PROJECT_ID") ?? "";
  const location = Deno.env.get("GCP_LOCATION") ?? "us-central1";
  const model = Deno.env.get("VERTEX_OPENAI_MODEL") ?? "google/gemini-2.0-flash-001";
  const saJson = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ?? "";

  if (!projectId) return json(req, { error: "Missing GCP_PROJECT_ID" }, 500);
  if (!saJson) return json(req, { error: "Missing GCP_SERVICE_ACCOUNT_JSON" }, 500);

  let sa: GoogleServiceAccount;
  try {
    sa = JSON.parse(saJson) as GoogleServiceAccount;
  } catch {
    return json(req, { error: "GCP_SERVICE_ACCOUNT_JSON is not valid JSON" }, 500);
  }

  let body: LessonPlan4ARequest;
  try {
    body = (await req.json()) as LessonPlan4ARequest;
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const title = String(body.title ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const gradeLevel = String(body.grade_level ?? "").trim();
  const track = String(body.track ?? "").trim();
  const strand = String(body.strand ?? "").trim();
  const tone: Tone = body.tone ?? "standard";
  const durationMinutes = Number(body.duration_minutes ?? 45);

  if (title.length < 3) return json(req, { error: "Title is required" }, 400);
  if (!subject) return json(req, { error: "Subject is required" }, 400);
  if (!gradeLevel) return json(req, { error: "Grade level is required" }, 400);

  try {
    // 0) Enforce daily quota (consume 1 assist)
    const quota = await consumeAssist(authed.supabase, authed.user.id);
    if (!quota.allowed) {
      return json(
        req,
        { error: "Daily AI assist limit reached", remaining: quota.remaining, used: quota.used, limit: 10 },
        429,
      );
    }

    // 1) Google OAuth token
    const accessToken = await getGoogleAccessToken(sa);

    // 2) Generate
    const prompt = buildPlanPrompt({
      title,
      subject,
      gradeLevel,
      track,
      strand,
      tone,
      durationMinutes,
    });

    const temperature = tone === "simple" ? 0.5 : tone === "detailed" ? 0.7 : 0.6;

    const raw = await callVertexChat({ accessToken, projectId, location, model, prompt, temperature });

    // 3) Parse JSON
    let parsed = safeParseJson(raw);

    // 4) Repair pass if invalid
    if (!parsed || !validatePlanShape(parsed)) {
      const repairPrompt = `
Return ONLY valid JSON (no markdown, no explanations).
Fix the following text so it becomes valid JSON matching the required shape:
${raw}
`.trim();

      const repairedText = await callVertexChat({
        accessToken,
        projectId,
        location,
        model,
        prompt: repairPrompt,
        temperature: 0.2,
      });

      parsed = safeParseJson(repairedText);
    }

    if (!parsed || !validatePlanShape(parsed)) {
      return json(
        req,
        { error: "Model returned invalid JSON plan", remaining: quota.remaining, used: quota.used, limit: 10 },
        500,
      );
    }

    // 5) Force lesson meta fields we want consistent (don’t trust model for IDs)
    parsed.lesson = {
      lesson_id: "",
      title,
      subject_id: "",
      grade_id: "",
      track_id: "",
      strand_id: "",
      duration_minutes: durationMinutes,
      audience: "Whole Class",
      status: "Draft",
    };

    return json(
      req,
      {
        lesson: parsed.lesson,
        parts: parsed.parts,
        activities: parsed.activities,
        remaining: quota.remaining,
        used: quota.used,
        limit: 10,
      },
      200,
    );
  } catch (err: unknown) {
    console.error("lesson-plan-4a error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json(req, { error: "Server error", detail: msg }, 500);
  }
});
