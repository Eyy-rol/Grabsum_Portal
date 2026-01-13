import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BookOpen,
  Archive,
  Save,
  Sparkles,
  Upload,
  Eye,
  Pencil,
  Plus,
  Trash2,
  GripVertical,
  MoreHorizontal,
  Calendar,
  Tag,
  Users,
  Clock,
  Wand2,
  AlertTriangle,
  Layers,
} from "lucide-react";

// ✅ Supabase client (adjust path to your project structure)
import { supabase } from "@/lib/supabaseClient";

/**
 * Teacher Portal – Lesson Builder UI (Library)
 *
 * Pure JSX version (no TypeScript).
 *
 * Wired to Supabase (library lesson templates):
 * - public.lessons
 * - public.lesson_parts
 * - public.lesson_activities
 *
 * Behavior:
 * - Library lesson status: Draft | Published | Archived
 * - Published = ready-to-assign (teacher-only), NOT student visible
 * - Student visibility happens on lesson_instances (separate screen/editor)
 */

function uuid() {
  const c = globalThis;
  if (c?.crypto?.randomUUID) return c.crypto.randomUUID();
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const partTypeOptions = [
  "Overview",
  "Objectives",
  "Warm-up",
  "Direct Instruction",
  "Guided Practice",
  "Independent Practice",
  "Assessment",
  "Homework",
  "Materials",
  "Notes",
];

const activityTypeOptions = [
  "Discussion",
  "Worksheet",
  "Quiz",
  "Group Work",
  "Project",
  "Reflection",
  "Game",
];

function formatNow() {
  const d = new Date();
  return d.toLocaleString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function statusBadgeVariant(status) {
  if (status === "Draft") return "secondary";
  if (status === "Published") return "default";
  return "outline";
}

function Pill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm shadow-sm">
      <Icon className="h-4 w-4 opacity-70" />
      <div className="flex items-baseline gap-2">
        <span className="opacity-70">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/30 p-10 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-background shadow-sm">
        <AlertTriangle className="h-6 w-6 opacity-70" />
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 max-w-md text-sm opacity-70">{description}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function PreviewPane({ lesson }) {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {lesson.title || "Untitled Lesson"}
              </CardTitle>
              <CardDescription>
                {lesson.subjectLabel || "Subject"} • SHS Grade{" "}
                {lesson.gradeLabel || "—"} • {lesson.durationMinutes} min
              </CardDescription>
            </div>
            <Badge
              variant={statusBadgeVariant(lesson.status)}
              className="rounded-xl"
            >
              {lesson.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {lesson.tags.length ? (
              lesson.tags.map((t) => (
                <Badge key={t} variant="secondary" className="rounded-xl">
                  <Tag className="mr-1 h-3 w-3" />
                  {t}
                </Badge>
              ))
            ) : (
              <div className="text-sm opacity-60">No tags</div>
            )}
          </div>
          <Separator />
          <div className="space-y-6">
            {lesson.parts.length ? (
              lesson.parts.map((p) => (
                <div key={p.id} className="space-y-2">
                  <div className="text-base font-semibold">
                    {p.title || p.type}
                  </div>
                  {p.body ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed opacity-80">
                      {p.body}
                    </div>
                  ) : (
                    <div className="text-sm opacity-60">No content yet.</div>
                  )}
                  {p.activities?.length ? (
                    <div className="mt-3 rounded-2xl border bg-muted/30 p-4">
                      <div className="mb-2 text-sm font-semibold">
                        Activities
                      </div>
                      <div className="space-y-3">
                        {p.activities.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-2xl border bg-background p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="rounded-xl"
                                  >
                                    {a.type}
                                  </Badge>
                                  <div className="font-medium">{a.title}</div>
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-sm opacity-80">
                                  {a.instructions || "No instructions."}
                                </div>
                              </div>
                              <div className="text-xs opacity-70">
                                <Clock className="mr-1 inline h-3 w-3" />
                                {a.estimatedMinutes} min
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm opacity-60">No parts yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * ✅ Updated: AiGenerateDialog wired to Supabase Edge Function `lesson-generate`
 * - Generates based on tone/difficulty/include/prompt + lesson metadata
 * - Shows preview output
 * - Apply will APPEND via onApply (your existing applyAiPatch)
 */
function AiGenerateDialog({ open, onOpenChange, onApply, lesson }) {
  const [tone, setTone] = useState("Friendly");
  const [difficulty, setDifficulty] = useState("On-level");
  const [include, setInclude] = useState({
    objectives: true,
    warmup: true,
    activities: true,
    assessment: true,
  });
  const [prompt, setPrompt] = useState(
    "Generate engaging content and classroom-ready activities aligned to the lesson details."
  );

  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState(null);
  const [result, setResult] = useState(null); // expected: { parts, tags, summary?, used?, limit? }

  const includeOptions = useMemo(
    () => [
      { key: "objectives", label: "Objectives" },
      { key: "warmup", label: "Warm-up" },
      { key: "activities", label: "Activities" },
      { key: "assessment", label: "Assessment" },
    ],
    []
  );

  // Extract nicer error body from functions.invoke error object
  async function extractInvokeError(err) {
    try {
      const ctx = err?.context;
      if (ctx?.text) {
        const txt = await ctx.text();
        try {
          const j = JSON.parse(txt);
          const message =
            j?.detail
              ? `${j.error}${j.status ? ` (HTTP ${j.status})` : ""}: ${j.detail}`
              : (j?.error || txt);
          return { message, meta: j };
        } catch {
          return { message: txt, meta: null };
        }
      }
    } catch {}
    return { message: err?.message || "Failed to send a request to the Edge Function", meta: null };
  }


  async function generate() {
    setLoading(true);
    setGenError(null);
    setResult(null);

    // keep payload small & stable
    const payload = {
      lesson: {
        title: lesson.title,
        subjectLabel: lesson.subjectLabel,
        gradeLabel: lesson.gradeLabel,
        trackLabel: lesson.trackLabel,
        strandLabel: lesson.strandLabel,
        durationMinutes: lesson.durationMinutes,
        audience: lesson.audience,
        tags: lesson.tags,
      },
      tone,
      difficulty,
      include,
      prompt,
      mode: "append",
    };

const {
  data: { session },
  error: sessionErr,
} = await supabase.auth.getSession();

if (sessionErr) throw new Error(sessionErr.message);
if (!session?.access_token) throw new Error("You must be logged in to use AI.");

const overviewPayload = {
  title: lesson.title,
  // You can optionally pass objectives as an array (if your lesson-overview function supports it)
  objectives: lesson.parts
    .find((p) => (p.type || "").toLowerCase() === "objectives")
    ?.body?.split("\n")
    .map((s) => s.trim())
    .filter(Boolean) || [],
  tone: (tone || "Friendly").toLowerCase(), // adapt if your edge fn expects "simple|standard|detailed"
};

const { data, error } = await supabase.functions.invoke("lesson-overview", {
  body: overviewPayload,
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});



    if (error) {
      const parsed = await extractInvokeError(error);
      const msg = parsed.message || "Generation failed.";

      // friendlier quota message
      if (msg.toLowerCase().includes("daily ai generation limit")) {
        setGenError("You’ve reached today’s AI limit (10/day). Try again tomorrow (UTC reset).");
      } else {
        setGenError(msg);
      }

      setLoading(false);
      return;
    }

    setResult(data);
    setLoading(false);
  }

  const previewParts = result?.parts || [];
  const previewTags = result?.tags || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> AI Lesson Generator
          </DialogTitle>
          <DialogDescription>
            Generate lesson content and activities based on your lesson details. Review the output before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 overflow-y-auto pr-1 -mr-1">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>
                Control tone, difficulty, and which components to include.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone} disabled={loading}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Friendly">Friendly</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Playful">Playful</SelectItem>
                    <SelectItem value="Encouraging">Encouraging</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Difficulty</Label>
                <Select
                  value={difficulty}
                  onValueChange={setDifficulty}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remedial">Remedial</SelectItem>
                    <SelectItem value="On-level">On-level</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Include</Label>
                <div className="grid gap-3 rounded-2xl border bg-muted/30 p-3">
                  {includeOptions.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="text-sm">{label}</div>
                      <Switch
                        checked={Boolean(include[key])}
                        disabled={loading}
                        onCheckedChange={(v) =>
                          setInclude((p) => ({ ...p, [key]: v }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[96px] rounded-2xl"
                  placeholder="Describe what you want the AI to generate…"
                  disabled={loading}
                />
                <div className="text-xs opacity-70">
                  Tip: Mention standards, vocabulary, or any student needs (ELL,
                  SPED, enrichment).
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="rounded-2xl w-full"
                  onClick={generate}
                  disabled={loading}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {loading ? "Generating…" : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setResult(null);
                    setGenError(null);
                  }}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>

              {genError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <div className="font-medium">Generation error</div>
                  <div className="mt-1 opacity-80">{genError}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Preview Output</CardTitle>
              <CardDescription>
                Output returned from your Edge Function.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                <div className="font-medium">Generation summary</div>
                <div className="mt-1 opacity-80">
                  {result?.summary
                    ? result.summary
                    : loading
                    ? "Generating…"
                    : previewParts.length
                    ? `Generated ${previewParts.length} part(s).`
                    : "No output yet. Click Generate."}
                </div>
                <div className="mt-2 opacity-70">Prompt: {prompt}</div>
              </div>

              <div className="space-y-3">
                {previewParts.length ? (
                  previewParts.map((p) => (
                    <div
                      key={p.id || `${p.type}-${p.title}`}
                      className="rounded-2xl border bg-background p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{p.title}</div>
                        <Badge variant="outline" className="rounded-xl">
                          {p.type}
                        </Badge>
                      </div>
                      <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm opacity-80">
                        {p.body}
                      </div>
                      {p.activities?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {p.activities.map((a) => (
                            <Badge
                              key={a.id || `${a.type}-${a.title}`}
                              variant="secondary"
                              className="rounded-xl"
                            >
                              {a.type}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm opacity-60">
                    {loading ? "Generating…" : "No output yet."}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-muted/30 p-3">
                <div className="mb-2 text-sm font-semibold">Suggested tags</div>
                <div className="flex flex-wrap gap-2">
                  {previewTags.length ? (
                    previewTags.map((t) => (
                      <Badge key={t} variant="secondary" className="rounded-xl">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <div className="text-sm opacity-60">No tags returned.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="rounded-2xl"
            disabled={loading || !result || !previewParts.length}
            onClick={() => {
              onApply({ parts: previewParts, tags: previewTags });
              onOpenChange(false);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Apply to Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartEditor({
  part,
  index,
  onUpdate,
  onDelete,
  onMove,
  onToggleCollapse,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border bg-muted/30">
              <GripVertical className="h-4 w-4 opacity-70" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  {part.title || part.type}
                </CardTitle>
                <Badge variant="outline" className="rounded-xl">
                  {part.type}
                </Badge>
              </div>
              <CardDescription>Part {index + 1}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => onMove("up")}
            >
              ↑
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => onMove("down")}
            >
              ↓
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuLabel>Part actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleCollapse}>
                  {part.collapsed ? "Expand" : "Collapse"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddActivity}>
                  <Plus className="mr-2 h-4 w-4" /> Add activity
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete part
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input
              value={part.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="rounded-2xl"
              placeholder="e.g., Warm-up (5 minutes)"
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={part.type}
              onValueChange={(v) => onUpdate({ type: v })}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {partTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!part.collapsed ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Content</Label>
                <Textarea
                  value={part.body}
                  onChange={(e) => onUpdate({ body: e.target.value })}
                  className="min-h-[120px] rounded-2xl"
                  placeholder="Write lesson content…"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs opacity-70">
                    Tip: Use the AI generator to draft content and activities,
                    then tweak.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl"
                    onClick={onAddActivity}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Activity
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Activities</div>
                  <div className="text-xs opacity-70">
                    Attachable is a flag for instance-level file uploads later.
                  </div>
                </div>

                {part.activities.length ? (
                  part.activities.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border bg-muted/30 p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={a.type}
                            onValueChange={(v) =>
                              onUpdateActivity(a.id, { type: v })
                            }
                          >
                            <SelectTrigger className="rounded-2xl">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {activityTypeOptions.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Title</Label>
                          <Input
                            value={a.title}
                            onChange={(e) =>
                              onUpdateActivity(a.id, { title: e.target.value })
                            }
                            className="rounded-2xl"
                            placeholder="e.g., 5-question quick check"
                          />
                        </div>

                        <div className="md:col-span-2 grid gap-2">
                          <Label>Instructions</Label>
                          <Textarea
                            value={a.instructions}
                            onChange={(e) =>
                              onUpdateActivity(a.id, {
                                instructions: e.target.value,
                              })
                            }
                            className="min-h-[90px] rounded-2xl"
                            placeholder="What will students do? What will the teacher do?"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 md:col-span-2">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="grid gap-2">
                              <Label>Estimated minutes</Label>
                              <Input
                                type="number"
                                value={a.estimatedMinutes}
                                onChange={(e) =>
                                  onUpdateActivity(a.id, {
                                    estimatedMinutes: clamp(
                                      Number(e.target.value || 0),
                                      0,
                                      999
                                    ),
                                  })
                                }
                                className="w-32 rounded-2xl"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-6">
                              <Checkbox
                                checked={a.attachable}
                                onCheckedChange={(v) =>
                                  onUpdateActivity(a.id, {
                                    attachable: Boolean(v),
                                  })
                                }
                              />
                              <Label className="text-sm">Attachable</Label>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-2xl text-destructive"
                            onClick={() => onDeleteActivity(a.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm opacity-60">No activities yet.</div>
                )}
              </div>
            </CardContent>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

export default function TeacherLessonBuilderPage() {
  // Lookups
  const [tracks, setTracks] = useState([]);
  const [strands, setStrands] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);

  // UI state
  const [tab, setTab] = useState("build");
  const [aiOpen, setAiOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Lesson state
  const [lesson, setLesson] = useState(() => ({
    id: uuid(),
    title: "",

    trackId: null,
    strandId: null,
    subjectId: null,
    gradeId: null,

    trackLabel: "",
    strandLabel: "",
    subjectLabel: "",
    gradeLabel: "11",

    durationMinutes: 45,
    scheduledDate: "",
    tags: [],
    audience: "Whole Class",
    status: "Draft",
    parts: [
      {
        id: uuid(),
        type: "Overview",
        title: "Lesson Overview",
        body: "",
        activities: [],
      },
      {
        id: uuid(),
        type: "Objectives",
        title: "Learning Objectives",
        body: "",
        activities: [],
      },
    ],
    lastSavedAt: "",
  }));

  // Fetch lookups
  useEffect(() => {
    let active = true;
    (async () => {
      setErrorMsg(null);
      const [t, s, g] = await Promise.all([
        supabase
          .from("tracks")
          .select("track_id, track_code, description")
          .order("track_code"),
        supabase
          .from("strands")
          .select("strand_id, track_id, strand_code, description")
          .order("strand_code"),
        supabase
          .from("grade_levels")
          .select("grade_id, grade_level")
          .in("grade_level", [11, 12])
          .order("grade_level"),
      ]);

      if (!active) return;

      if (t.error) setErrorMsg(t.error.message);
      if (s.error) setErrorMsg(s.error.message);
      if (g.error) setErrorMsg(g.error.message);

      setTracks(t.data ?? []);
      setStrands(s.data ?? []);
      setGrades(g.data ?? []);

      const subjRes = await supabase
        .from("subjects")
        .select("subject_id, subject_title, strand_id, grade_id, is_archived")
        .eq("is_archived", false)
        .order("subject_title");

      if (!active) return;
      if (subjRes.error) setErrorMsg(subjRes.error.message);
      setSubjects(subjRes.data ?? []);

      // Default gradeId from gradeLabel
      const initialGradeLevel = Number(lesson.gradeLabel || "11");
      const foundGrade = (g.data ?? []).find(
        (x) => x.grade_level === initialGradeLevel
      );
      if (foundGrade?.grade_id) {
        setLesson((p) => ({ ...p, gradeId: foundGrade.grade_id }));
      }

      // Default track/strand
      if ((t.data ?? []).length && !lesson.trackId) {
        const firstTrack = t.data[0];
        const firstStrand = (s.data ?? []).find(
          (x) => x.track_id === firstTrack.track_id
        );
        setLesson((p) => ({
          ...p,
          trackId: firstTrack.track_id,
          strandId: firstStrand?.strand_id ?? null,
          trackLabel: firstTrack.track_code,
          strandLabel: firstStrand?.strand_code ?? "",
        }));
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load lesson by ?lessonId=...
  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const lessonId = params.get("lessonId");
    if (!lessonId) return;

    let active = true;
    (async () => {
      setLoadingLesson(true);
      setErrorMsg(null);
      try {
        const lRes = await supabase
          .from("lessons")
          .select(
            "lesson_id, title, grade_id, track_id, strand_id, subject_id, duration_minutes, audience, status"
          )
          .eq("lesson_id", lessonId)
          .single();
        if (lRes.error) throw lRes.error;

        const pRes = await supabase
          .from("lesson_parts")
          .select(
            "part_id, lesson_id, sort_order, part_type, title, body, is_collapsed"
          )
          .eq("lesson_id", lessonId)
          .order("sort_order", { ascending: true });
        if (pRes.error) throw pRes.error;

        const partIds = (pRes.data ?? []).map((x) => x.part_id);

        const aRes = partIds.length
          ? await supabase
              .from("lesson_activities")
              .select(
                "activity_id, part_id, sort_order, activity_type, title, instructions, estimated_minutes, attachable"
              )
              .in("part_id", partIds)
              .order("sort_order", { ascending: true })
          : { data: [], error: null };
        if (aRes?.error) throw aRes.error;

        if (!active) return;

        const header = lRes.data;
        const track = tracks.find((t) => t.track_id === header.track_id);
        const strand = strands.find((s) => s.strand_id === header.strand_id);
        const subject = subjects.find((s) => s.subject_id === header.subject_id);
        const grade = grades.find((g) => g.grade_id === header.grade_id);

        const activitiesByPart = new Map();
        (aRes.data ?? []).forEach((a) => {
          const arr = activitiesByPart.get(a.part_id) ?? [];
          arr.push(a);
          activitiesByPart.set(a.part_id, arr);
        });

        const mappedParts = (pRes.data ?? []).map((p) => ({
          id: p.part_id,
          type: p.part_type,
          title: p.title,
          body: p.body ?? "",
          collapsed: Boolean(p.is_collapsed),
          activities: (activitiesByPart.get(p.part_id) ?? []).map((a) => ({
            id: a.activity_id,
            type: a.activity_type,
            title: a.title,
            instructions: a.instructions ?? "",
            estimatedMinutes: a.estimated_minutes ?? 5,
            attachable: Boolean(a.attachable),
          })),
        }));

        setLesson((prev) => ({
          ...prev,
          id: header.lesson_id,
          title: header.title ?? "",
          gradeId: header.grade_id,
          trackId: header.track_id,
          strandId: header.strand_id,
          subjectId: header.subject_id,
          durationMinutes: header.duration_minutes ?? 45,
          audience: header.audience ?? "Whole Class",
          status: header.status ?? "Draft",
          gradeLabel: grade ? String(grade.grade_level) : prev.gradeLabel,
          trackLabel: track?.track_code ?? prev.trackLabel,
          strandLabel: strand?.strand_code ?? prev.strandLabel,
          subjectLabel: subject?.subject_title ?? prev.subjectLabel,
          parts: mappedParts.length ? mappedParts : prev.parts,
          lastSavedAt: formatNow(),
        }));
      } catch (e) {
        setErrorMsg(e?.message ?? "Failed to load lesson");
      } finally {
        setLoadingLesson(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, strands.length, subjects.length, grades.length]);

  // Derived options
  const strandOptions = useMemo(() => {
    if (!lesson.trackId) return [];
    return strands.filter((s) => s.track_id === lesson.trackId);
  }, [lesson.trackId, strands]);

  const subjectOptions = useMemo(() => {
    return subjects
      .filter((s) => !s.is_archived)
      .filter((s) =>
        lesson.strandId ? s.strand_id === lesson.strandId || s.strand_id == null : true
      )
      .filter((s) =>
        lesson.gradeId ? s.grade_id === lesson.gradeId || s.grade_id == null : true
      )
      .map((s) => ({ id: s.subject_id, label: s.subject_title }));
  }, [subjects, lesson.strandId, lesson.gradeId]);

  const canPublish = useMemo(() => {
    if (lesson.status === "Archived") return false;
    const hasTitle = lesson.title.trim().length > 0;
    const hasAnyContent = lesson.parts.some(
      (p) => p.body.trim().length > 0 || p.activities.length > 0
    );
    return hasTitle && hasAnyContent;
  }, [lesson]);

  const progress = useMemo(() => {
    const fields = [
      lesson.title.trim().length > 0,
      Boolean(lesson.subjectId),
      Boolean(lesson.gradeId),
      lesson.durationMinutes > 0,
      lesson.parts.length > 0,
      lesson.parts.some((p) => p.body.trim().length > 0),
      lesson.parts.some((p) => p.activities.length > 0),
    ];
    const done = fields.filter(Boolean).length;
    return Math.round((done / fields.length) * 100);
  }, [lesson]);

  // DB persistence: upsert lesson header, replace parts+activities
  async function persistLesson(nextStatus) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated.");

      const status = nextStatus ?? lesson.status;

      const headerPayload = {
        lesson_id: lesson.id,
        owner_teacher_id: uid,
        title: lesson.title,
        grade_id: lesson.gradeId,
        track_id: lesson.trackId,
        strand_id: lesson.strandId,
        subject_id: lesson.subjectId,
        duration_minutes: lesson.durationMinutes,
        audience: lesson.audience,
        status,
      };

      const upsertLesson = await supabase
        .from("lessons")
        .upsert(headerPayload, { onConflict: "lesson_id" })
        .select("lesson_id")
        .single();
      if (upsertLesson.error) throw upsertLesson.error;

      const delParts = await supabase
        .from("lesson_parts")
        .delete()
        .eq("lesson_id", lesson.id);
      if (delParts.error) throw delParts.error;

      const partsRows = lesson.parts.map((p, idx) => ({
        part_id: p.id,
        lesson_id: lesson.id,
        sort_order: idx + 1,
        part_type: p.type,
        title: p.title || p.type,
        body: p.body,
        is_collapsed: Boolean(p.collapsed),
      }));

      if (partsRows.length) {
        const insParts = await supabase.from("lesson_parts").insert(partsRows);
        if (insParts.error) throw insParts.error;
      }

      const partIds = partsRows.map((x) => x.part_id);
      if (partIds.length) {
        const delActs = await supabase
          .from("lesson_activities")
          .delete()
          .in("part_id", partIds);
        if (delActs.error) throw delActs.error;
      }

      const actRows = [];
      lesson.parts.forEach((p) => {
        p.activities.forEach((a, aIdx) => {
          actRows.push({
            activity_id: a.id,
            part_id: p.id,
            sort_order: aIdx + 1,
            activity_type: a.type,
            title: a.title || a.type,
            instructions: a.instructions,
            estimated_minutes: a.estimatedMinutes,
            attachable: a.attachable,
          });
        });
      });

      if (actRows.length) {
        const insActs = await supabase.from("lesson_activities").insert(actRows);
        if (insActs.error) throw insActs.error;
      }

      setLesson((p) => ({ ...p, status, lastSavedAt: formatNow() }));
    } catch (e) {
      setErrorMsg(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function saveDraft() {
    persistLesson("Draft");
  }

  function publishLesson() {
    persistLesson("Published");
  }

  function archiveLesson() {
    persistLesson("Archived");
  }

  // Editing helpers
  function addPart() {
    setLesson((p) => ({
      ...p,
      parts: [
        ...p.parts,
        { id: uuid(), type: "Notes", title: "New Part", body: "", activities: [] },
      ],
    }));
  }

  function updatePart(partId, patch) {
    setLesson((p) => ({
      ...p,
      parts: p.parts.map((x) => (x.id === partId ? { ...x, ...patch } : x)),
    }));
  }

  function deletePart(partId) {
    setLesson((p) => ({ ...p, parts: p.parts.filter((x) => x.id !== partId) }));
  }

  function movePart(partId, dir) {
    setLesson((p) => {
      const idx = p.parts.findIndex((x) => x.id === partId);
      if (idx < 0) return p;
      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= p.parts.length) return p;
      const next = [...p.parts];
      const tmp = next[idx];
      next[idx] = next[swapWith];
      next[swapWith] = tmp;
      return { ...p, parts: next };
    });
  }

  function addActivity(partId) {
    setLesson((p) => ({
      ...p,
      parts: p.parts.map((x) => {
        if (x.id !== partId) return x;
        const activity = {
          id: uuid(),
          type: "Discussion",
          title: "New Activity",
          instructions: "",
          estimatedMinutes: 5,
          attachable: false,
        };
        return { ...x, activities: [...x.activities, activity] };
      }),
    }));
  }

  function updateActivity(partId, activityId, patch) {
    setLesson((p) => ({
      ...p,
      parts: p.parts.map((x) => {
        if (x.id !== partId) return x;
        return {
          ...x,
          activities: x.activities.map((a) =>
            a.id === activityId ? { ...a, ...patch } : a
          ),
        };
      }),
    }));
  }

  function deleteActivity(partId, activityId) {
    setLesson((p) => ({
      ...p,
      parts: p.parts.map((x) => {
        if (x.id !== partId) return x;
        return { ...x, activities: x.activities.filter((a) => a.id !== activityId) };
      }),
    }));
  }

  function applyAiPatch(patch) {
    setLesson((prev) => {
      const incomingParts = (patch.parts || []).map((pp) => ({
        id: pp.id || uuid(),
        type: pp.type || "Notes",
        title: pp.title || "Generated Part",
        body: pp.body || "",
        activities: pp.activities || [],
        collapsed: false,
      }));

      const mergedTags = Array.from(
        new Set([...(prev.tags || []), ...(patch.tags || [])])
      )
        .filter(Boolean)
        .slice(0, 12);

      return {
        ...prev,
        parts: [...prev.parts, ...incomingParts],
        tags: mergedTags,
        lastSavedAt: formatNow(),
      };
    });
  }

  // Keep labels in sync when IDs change
  useEffect(() => {
    const t = tracks.find((x) => x.track_id === lesson.trackId);
    const s = strands.find((x) => x.strand_id === lesson.strandId);
    const subj = subjects.find((x) => x.subject_id === lesson.subjectId);
    const g = grades.find((x) => x.grade_id === lesson.gradeId);

    setLesson((p) => ({
      ...p,
      trackLabel: t?.track_code ?? p.trackLabel,
      strandLabel: s?.strand_code ?? p.strandLabel,
      subjectLabel: subj?.subject_title ?? p.subjectLabel,
      gradeLabel: g ? String(g.grade_level) : p.gradeLabel,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lesson.trackId,
    lesson.strandId,
    lesson.subjectId,
    lesson.gradeId,
    tracks.length,
    strands.length,
    subjects.length,
    grades.length,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-muted/30 shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">
                      Lesson Builder (Library)
                    </div>
                    <div className="text-sm opacity-70">
                      Draft, publish (ready-to-assign), and archive lesson templates. Student visibility is controlled by assigned instances.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setAiOpen(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={saveDraft}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />{" "}
                  {saving ? "Saving…" : "Save Draft"}
                </Button>

                <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="rounded-2xl"
                      disabled={!canPublish || saving}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Publish
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Publish lesson template?</DialogTitle>
                      <DialogDescription>
                        Publishing marks this lesson as <b>ready to assign</b> (teacher-only). Students won’t see it until you assign it to a class.
                      </DialogDescription>
                    </DialogHeader>
                    {!canPublish ? (
                      <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                        Add a title and at least one part with content or an activity to publish.
                      </div>
                    ) : (
                      <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                        <div className="font-medium">Ready to publish</div>
                        <div className="mt-1 opacity-80">
                          This will appear in your “Ready to assign” library list.
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setPublishOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-2xl"
                        disabled={!canPublish || saving}
                        onClick={async () => {
                          await publishLesson();
                          setPublishOpen(false);
                        }}
                      >
                        Publish
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-2xl">
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Archive lesson template?</DialogTitle>
                      <DialogDescription>
                        Archiving hides the lesson from your active library list.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                      You can duplicate an archived template later if you want to reuse it.
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setArchiveOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-2xl"
                        disabled={saving}
                        onClick={async () => {
                          await archiveLesson();
                          setArchiveOpen(false);
                        }}
                      >
                        Archive
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setTab((t) => (t === "build" ? "preview" : "build"))}
                >
                  {tab === "build" ? (
                    <>
                      <Eye className="mr-2 h-4 w-4" /> Preview
                    </>
                  ) : (
                    <>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loadingLesson ? (
              <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                Loading lesson…
              </div>
            ) : null}
            {errorMsg ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <div className="font-medium">Error</div>
                <div className="mt-1 opacity-80">{errorMsg}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Pill icon={Layers} label="Track" value={lesson.trackLabel || "—"} />
                <Pill icon={Tag} label="Strand" value={lesson.strandLabel || "—"} />
                <Pill icon={Users} label="Audience" value={lesson.audience} />
                <Pill icon={Clock} label="Duration" value={`${lesson.durationMinutes} min`} />
                <Pill icon={Calendar} label="Scheduled" value={lesson.scheduledDate || "Not set"} />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={statusBadgeVariant(lesson.status)} className="rounded-xl">
                  {lesson.status}
                </Badge>
                <div className="text-xs opacity-70">
                  {lesson.lastSavedAt ? `Last saved: ${lesson.lastSavedAt}` : "Not saved yet"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Lesson details</CardTitle>
                  <CardDescription>
                    Saved to Supabase: lessons, lesson_parts, lesson_activities.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Lesson title</Label>
                    <Input
                      value={lesson.title}
                      onChange={(e) => setLesson((p) => ({ ...p, title: e.target.value }))}
                      className="rounded-2xl"
                      placeholder="e.g., Understanding Theme in Short Stories"
                      disabled={lesson.status === "Archived"}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Track</Label>
                    <Select
                      value={lesson.trackId ?? ""}
                      onValueChange={(v) => {
                        const nextTrackId = v;
                        const firstStrand = strands.find((x) => x.track_id === nextTrackId);
                        setLesson((p) => ({
                          ...p,
                          trackId: nextTrackId,
                          strandId: firstStrand?.strand_id ?? null,
                        }));
                      }}
                      disabled={lesson.status === "Archived"}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select track" />
                      </SelectTrigger>
                      <SelectContent>
                        {tracks.map((t) => (
                          <SelectItem key={t.track_id} value={t.track_id}>
                            {t.track_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Strand</Label>
                    <Select
                      value={lesson.strandId ?? ""}
                      onValueChange={(v) => setLesson((p) => ({ ...p, strandId: v }))}
                      disabled={lesson.status === "Archived" || !lesson.trackId}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder={lesson.trackId ? "Select strand" : "Select track first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {strandOptions.map((s) => (
                          <SelectItem key={s.strand_id} value={s.strand_id}>
                            {s.strand_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Subject</Label>
                    <Select
                      value={lesson.subjectId ?? ""}
                      onValueChange={(v) => setLesson((p) => ({ ...p, subjectId: v }))}
                      disabled={lesson.status === "Archived"}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectOptions.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>SHS Grade level</Label>
                    <Select
                      value={lesson.gradeId ?? ""}
                      onValueChange={(v) => setLesson((p) => ({ ...p, gradeId: v }))}
                      disabled={lesson.status === "Archived"}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g.grade_id} value={g.grade_id}>
                            SHS Grade {g.grade_level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={lesson.durationMinutes}
                      onChange={(e) =>
                        setLesson((p) => ({
                          ...p,
                          durationMinutes: clamp(Number(e.target.value || 0), 0, 999),
                        }))
                      }
                      className="rounded-2xl"
                      disabled={lesson.status === "Archived"}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Audience</Label>
                    <Select
                      value={lesson.audience}
                      onValueChange={(v) => setLesson((p) => ({ ...p, audience: v }))}
                      disabled={lesson.status === "Archived"}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Whole Class">Whole Class</SelectItem>
                        <SelectItem value="Small Group">Small Group</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Scheduled date (optional)</Label>
                    <Input
                      value={lesson.scheduledDate}
                      onChange={(e) => setLesson((p) => ({ ...p, scheduledDate: e.target.value }))}
                      className="rounded-2xl"
                      placeholder="YYYY-MM-DD"
                      disabled={lesson.status === "Archived"}
                    />
                  </div>

                  <div className="grid gap-2 md:col-span-2">
                    <Label>Tags (UI-only)</Label>
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/30 p-3">
                      {lesson.tags.length ? (
                        lesson.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="rounded-xl">
                            {t}
                          </Badge>
                        ))
                      ) : (
                        <div className="text-sm opacity-60">
                          No tags yet. Add tags using AI or type below.
                        </div>
                      )}
                      <div className="ml-auto flex w-full gap-2 md:w-auto">
                        <Input
                          className="rounded-2xl"
                          placeholder="Add a tag and press Enter"
                          disabled={lesson.status === "Archived"}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            const v = (e.currentTarget.value || "").trim();
                            if (!v) return;
                            setLesson((p) => ({
                              ...p,
                              tags: Array.from(new Set([...p.tags, v])).slice(0, 12),
                            }));
                            e.currentTarget.value = "";
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                      <div className="font-medium">Database wiring</div>
                      <div className="mt-1 opacity-80">
                        Saving will write to <code>lessons</code>, <code>lesson_parts</code>, and{" "}
                        <code>lesson_activities</code>. Publishing here only marks it as ready to assign.
                      </div>
                      <div className="mt-2 text-xs opacity-70">
                        Tip: You can open a saved lesson by adding <code>?lessonId=YOUR_UUID</code> to the URL.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Lesson parts</CardTitle>
                      <CardDescription>
                        Structured parts + activities (persisted to Supabase on save).
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setAiOpen(true)}
                      >
                        <Wand2 className="mr-2 h-4 w-4" /> AI assist
                      </Button>
                      <Button
                        className="rounded-2xl"
                        onClick={addPart}
                        disabled={lesson.status === "Archived"}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add part
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lesson.status === "Archived" ? (
                    <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                      This lesson is archived. Duplicate to edit.
                    </div>
                  ) : null}

                  {lesson.parts.length ? (
                    <div className="space-y-4">
                      {lesson.parts.map((part, idx) => (
                        <PartEditor
                          key={part.id}
                          part={part}
                          index={idx}
                          onUpdate={(patch) => updatePart(part.id, patch)}
                          onDelete={() => deletePart(part.id)}
                          onMove={(dir) => movePart(part.id, dir)}
                          onToggleCollapse={() =>
                            updatePart(part.id, { collapsed: !part.collapsed })
                          }
                          onAddActivity={() => addActivity(part.id)}
                          onUpdateActivity={(activityId, patch) =>
                            updateActivity(part.id, activityId, patch)
                          }
                          onDeleteActivity={(activityId) =>
                            deleteActivity(part.id, activityId)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No parts yet"
                      description="Add lesson parts like Objectives, Warm-up, Guided Practice, and Assessment to get started."
                      action={
                        <Button className="rounded-2xl" onClick={addPart}>
                          <Plus className="mr-2 h-4 w-4" /> Add your first part
                        </Button>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v)}>
                <TabsList className="w-full rounded-2xl">
                  <TabsTrigger value="build" className="w-full rounded-2xl">
                    Build
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="w-full rounded-2xl">
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="build" className="mt-4 space-y-6">
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Publishing checklist
                      </CardTitle>
                      <CardDescription>
                        A quick guide to help you get this lesson ready to assign.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Completion</div>
                        <Badge variant="secondary" className="rounded-xl">
                          {progress}%
                        </Badge>
                      </div>
                      <Separator />
                      <ChecklistItem label="Title added" ok={lesson.title.trim().length > 0} />
                      <ChecklistItem label="At least one part" ok={lesson.parts.length > 0} />
                      <ChecklistItem label="Content written" ok={lesson.parts.some((p) => p.body.trim().length > 0)} />
                      <ChecklistItem label="Activity included" ok={lesson.parts.some((p) => p.activities.length > 0)} />
                      <ChecklistItem label="Not archived" ok={lesson.status !== "Archived"} />
                      <div className="pt-2">
                        <Button
                          className="w-full rounded-2xl"
                          disabled={!canPublish || saving}
                          onClick={() => setPublishOpen(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" /> Publish (Ready to assign)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">AI generation tips</CardTitle>
                      <CardDescription>
                        Make AI output more classroom-ready with a few key details.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <TipLine>Mention student needs: ELL, SPED accommodations, enrichment.</TipLine>
                      <TipLine>Ask for differentiation: basic, on-level, challenge.</TipLine>
                      <TipLine>Request rubrics for projects or writing tasks.</TipLine>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          className="w-full rounded-2xl"
                          onClick={() => setAiOpen(true)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" /> Open AI Generator
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">Quick actions</CardTitle>
                      <CardDescription>Common lesson management actions.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl justify-start"
                        onClick={saveDraft}
                        disabled={saving}
                      >
                        <Save className="mr-2 h-4 w-4" /> Save as Draft
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl justify-start"
                        onClick={() => setPublishOpen(true)}
                        disabled={!canPublish || saving}
                      >
                        <Upload className="mr-2 h-4 w-4" /> Publish
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl justify-start"
                        onClick={() => setArchiveOpen(true)}
                        disabled={saving}
                      >
                        <Archive className="mr-2 h-4 w-4" /> Archive
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="preview" className="mt-4 space-y-6">
                  <PreviewPane lesson={lesson} />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <AiGenerateDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            onApply={applyAiPatch}
            lesson={lesson}
          />
        </motion.div>
      </div>
    </div>
  );
}

function ChecklistItem({ label, ok }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-muted/30 p-3">
      <div className="text-sm">{label}</div>
      <Badge variant={ok ? "default" : "outline"} className="rounded-xl">
        {ok ? "Done" : "To do"}
      </Badge>
    </div>
  );
}

function TipLine({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border bg-muted/30 p-3">
      <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl border bg-background shadow-sm">
        <Sparkles className="h-4 w-4 opacity-70" />
      </div>
      <div className="opacity-80">{children}</div>
    </div>
  );
}
