import React, { useEffect, useMemo, useState } from "react";
import { campaignService, tagService, savedSearchService } from "@/services";
import { UptoButton } from "@/components/UI/UptoHooks";
import { ArrowRight, ArrowLeft, Sparkles, Users, BarChart3, X } from "lucide-react";
import { toast } from "sonner";

const statuses = ["new", "contacted", "qualified", "in_progress", "converted", "closed", "lost"];
const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-200";

export default function CampaignStudio({ onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("new");
  const [min, setMin] = useState(40);
  const [max, setMax] = useState(100);
  const [tagId, setTagId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [tags, setTags] = useState([]);
  const [segments, setSegments] = useState([]);
  const [schedule, setSchedule] = useState("");
  const [tone, setTone] = useState("professional");
  const [goal, setGoal] = useState("replies");
  const [valueProp, setValueProp] = useState("");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [count, setCount] = useState(null);
  const [sample, setSample] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      tagService.list().catch(() => []),
      savedSearchService.list({ resource: "leads" }).catch(() => []),
    ]).then(([a, b]) => {
      setTags(Array.isArray(a) ? a : a?.tags || a?.items || a?.data || []);
      setSegments(Array.isArray(b) ? b : b?.items || b?.savedSearches || b?.data || []);
    });
  }, []);

  const audience = useMemo(
    () =>
      type === "status"
        ? { type, status }
        : type === "score"
        ? { type, operator: "between", min: Number(min), max: Number(max) }
        : type === "tag"
        ? { type, tagId: Number(tagId) }
        : type === "segment"
        ? { type, savedSearchId: Number(segmentId) }
        : { type: "all" },
    [type, status, min, max, tagId, segmentId]
  );

  const audienceLabel =
    type === "all"
      ? "All Leads"
      : type === "status"
      ? "Status: " + status
      : type === "score"
      ? "Lead score " + min + "–" + max
      : type === "tag"
      ? "Tag: " + (tags.find((t) => String(t.id) === String(tagId))?.name || "selected")
      : "Saved segment: " +
        (segments.find((s) => String(s.id) === String(segmentId))?.name || "selected");

  const scan = async () => {
    if (type === "tag" && !tagId) return toast.error("Select a tag first");
    if (type === "segment" && !segmentId) return toast.error("Select a saved segment first");
    if (
      type === "score" &&
      (min === "" ||
        max === "" ||
        !Number.isFinite(Number(min)) ||
        !Number.isFinite(Number(max)) ||
        Number(min) < 0 ||
        Number(max) > 100 ||
        Number(min) > Number(max))
    ) {
      return toast.error("Choose a valid score range from 0 to 100");
    }

    setBusy(true);
    try {
      setCount(null);
      setSample([]);
      const result = await campaignService.previewAudience(audience);
      const preview = result?.data ?? result;
      const total = Number(preview?.count);
      const examples = preview?.sample;
      if (!Number.isFinite(total) || total < 0 || !Array.isArray(examples)) {
        throw new Error("The backend returned an invalid audience preview.");
      }
      setCount(total);
      setSample(examples);
      toast.success(`Audience preview updated: ${total} matching leads`);
    } catch (e) {
      toast.error(e?.message || "Unable to preview audience");
    } finally {
      setBusy(false);
    }
  };

  const generateCopy = async () => {
    if (count === null) return toast.error("Preview the audience before generating drafts.");
    setCopyBusy(true);
    try {
      const result = await campaignService.previewCopy({
        audience,
        campaignName: name.trim(),
        tone,
        goal,
        valueProp: valueProp.trim(),
        prompt: prompt.trim(),
      });
      const data = result?.data ?? result;
      if (!Array.isArray(data?.variants) || !data.variants.length) {
        throw new Error("The AI service returned no email drafts.");
      }
      setVariants(data.variants);
      setSelectedVariant(data.variants[0]?.id ?? "");
      toast.success("Drafts generated. Review them before scheduling.");
    } catch (e) {
      toast.error(e?.message || "Could not generate email drafts");
    } finally {
      setCopyBusy(false);
    }
  };

  const save = async () => {
    // 1. Name Check
    if (!name.trim()) {
      setStep(0);
      return toast.error("Enter a campaign name first");
    }

    // 2. Audience checks
    if (type === "tag" && !tagId) {
      setStep(0);
      return toast.error("Select a tag");
    }
    if (type === "segment" && !segmentId) {
      setStep(0);
      return toast.error("Select a saved segment");
    }
    if (
      type === "score" &&
      (min === "" ||
        max === "" ||
        !Number.isFinite(Number(min)) ||
        !Number.isFinite(Number(max)) ||
        Number(min) < 0 ||
        Number(max) > 100 ||
        Number(min) > Number(max))
    ) {
      setStep(0);
      return toast.error("Choose a valid score range from 0 to 100");
    }

    // 3. Audience preview check
    if (count === null) {
      setStep(0);
      return toast.error("Preview the audience before saving to confirm expected leads.");
    }

    // 4. Generate Drafts Verification Condition
    if (!variants || variants.length === 0) {
      setStep(1); // Redirect user to Step 1 (Personalization)
      return toast.error("Please generate AI email drafts in Step 2 before saving the campaign.");
    }

    // 5. Schedule date & time checks
    if (!schedule) {
      return toast.error("Choose a scheduled date & time");
    }
    if (new Date(schedule) <= new Date()) {
      return toast.error("Choose a future schedule date and time");
    }

    setBusy(true);
    try {
      await campaignService.create({
        name: name.trim(),
        description: [
          "Campaign goal: " + goal + ".",
          "Email tone: " + tone + ".",
          valueProp.trim() ? "Value proposition: " + valueProp.trim() + "." : "",
          prompt.trim() ? "Campaign owner direction: " + prompt.trim() + "." : "",
          "Two-step sequence: Step 1 (Active) and Step 2 (Complete).",
        ]
          .filter(Boolean)
          .join(" "),
        audience,
        schedule: new Date(schedule).toISOString(),
        type: "email",
        content: [{ type: "SEND_EMAIL" }],
        steps: [
          { day: 0, time: new Date(schedule).toTimeString().slice(0, 5) },
          { day: 3, time: "10:00" },
        ],
      });
      toast.success(
        "Campaign scheduled for " +
          count +
          " matching leads. Gemini will personalize each email at send time."
      );
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not save campaign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute -top-3.5 -right-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 border border-slate-700 shadow-xl transition-all duration-200 hover:bg-rose-600 hover:text-white hover:scale-110 focus:outline-none"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Window Container */}
        <div className="w-full h-[84vh] min-h-[580px] max-h-[840px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          {/* Header */}
          <header className="border-b border-slate-100 px-6 sm:px-8 py-4 dark:border-slate-800 shrink-0">
            <p className="text-[11px] font-bold tracking-[0.16em] text-teal-600">
              SALESFORGE · CAMPAIGN STUDIO
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create campaign
            </h2>
          </header>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            {/* Inline Campaign Name & Input */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 max-w-2xl">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
                Campaign name :
              </label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q1 Outreach"
              />
            </div>

            {/* Stepper Tabs - Equal 3 Column Grid */}
            <nav
              aria-label="Campaign setup steps"
              className="grid grid-cols-3 gap-3 w-full border-b border-slate-200 pb-5 dark:border-slate-700"
            >
              {["1 · Audience", "2 · Personalization", "3 · Review"].map((x, i) => (
                <button
                  type="button"
                  key={x}
                  onClick={() => {
                    if (i > 0 && count === null) {
                      toast.error("Preview the audience before continuing.");
                      return;
                    }
                    setStep(i);
                  }}
                  className={
                    "w-full py-2.5 px-3 text-center rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 truncate " +
                    (step === i
                      ? "bg-teal-600 text-white shadow-md shadow-teal-500/20 font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")
                  }
                >
                  {x}
                </button>
              ))}
            </nav>

            {/* Step 0: Audience */}
            {step === 0 && (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Users className="h-4 w-4 text-teal-600" /> Define target audience
                </h3>

                <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
                  {/* Left: Criteria */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/40 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                        Audience criteria
                      </h4>
                      <div>
                        <label className={labelClass}>Audience</label>
                        <select
                          className={`${inputClass} mt-1`}
                          value={type}
                          onChange={(e) => {
                            setType(e.target.value);
                            setCount(null);
                            setSample([]);
                          }}
                        >
                          <option value="all">All Leads</option>
                          <option value="status">By Status</option>
                          <option value="tag">By Tag</option>
                          <option value="segment">By Saved Segment</option>
                          <option value="score">By Lead Score</option>
                        </select>
                      </div>

                      {type === "status" && (
                        <div>
                          <label className={labelClass}>Status</label>
                          <select
                            className={`${inputClass} mt-1`}
                            value={status}
                            onChange={(e) => {
                              setStatus(e.target.value);
                              setCount(null);
                              setSample([]);
                            }}
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {type === "tag" && (
                        <div>
                          <label className={labelClass}>Tag</label>
                          <select
                            className={`${inputClass} mt-1`}
                            value={tagId}
                            onChange={(e) => {
                              setTagId(e.target.value);
                              setCount(null);
                              setSample([]);
                            }}
                          >
                            <option value="">Choose tag</option>
                            {tags.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {type === "segment" && (
                        <div>
                          <label className={labelClass}>Saved segment</label>
                          <select
                            className={`${inputClass} mt-1`}
                            value={segmentId}
                            onChange={(e) => {
                              setSegmentId(e.target.value);
                              setCount(null);
                              setSample([]);
                            }}
                          >
                            <option value="">Choose segment</option>
                            {segments.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {type === "score" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Min score</label>
                            <input
                              className={`${inputClass} mt-1`}
                              type="number"
                              min="0"
                              max="100"
                              value={min}
                              onChange={(e) => {
                                setMin(e.target.value);
                                setCount(null);
                                setSample([]);
                              }}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Max score</label>
                            <input
                              className={`${inputClass} mt-1`}
                              type="number"
                              min="0"
                              max="100"
                              value={max}
                              onChange={(e) => {
                                setMax(e.target.value);
                                setCount(null);
                                setSample([]);
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="pt-3 text-xs leading-relaxed text-slate-500">
                      Choose which leads should be included in this campaign.
                    </p>
                  </div>

                  {/* Right: Preview Action Button */}
                  <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm dark:border-teal-900 dark:bg-slate-900 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Audience preview
                          </h4>
                          <p className="text-[11px] text-slate-500">Check the matching leads</p>
                        </div>
                      </div>

                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {audienceLabel}
                      </p>
                    </div>

                    <div className="pt-4">
                      <UptoButton onClick={scan} disabled={busy} className="w-full sm:w-auto">
                        {busy ? "Scanning…" : "Scan & Preview"}
                      </UptoButton>
                    </div>
                  </div>
                </div>

                {/* Bottom Full-Width Lead Results Card */}
                {count !== null && (
                  <div className="w-full rounded-xl border border-teal-200/90 bg-white p-5 shadow-sm dark:border-teal-900 dark:bg-slate-900 mt-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                      <div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          {count}
                        </span>
                        <p className="text-xs text-slate-500">
                          Matching leads from the current preview
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                        Preview Verified
                      </span>
                    </div>

                    {sample.length > 0 ? (
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1 pt-1">
                        {sample.map((l) => (
                          <div
                            key={l.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {l.name || "Unnamed"}
                              </span>{" "}
                              <span className="text-slate-500">
                                · {l.companyName || "No company"}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                              Score: {l.score ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-1">
                        No individual lead details found for this selection.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Step 1: Personalization */}
            {step === 1 && (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-teal-600" /> AI copy studio
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Set the direction only. Gemini generates a fresh subject and personalized email for
                  each lead when the campaign sends.
                </p>
                <div className="max-w-2xl">
                  <label className={labelClass}>Prompt or keywords</label>
                  <input
                    className={`${inputClass} mt-1`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={1000}
                    placeholder="e.g. introduce our CRM, highlight time savings, ask for a short meeting"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={labelClass}>Tone</label>
                    <select
                      className={`${inputClass} mt-1`}
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                    >
                      <option value="professional">Professional</option>
                      <option value="conversational">Conversational</option>
                      <option value="concise">Concise</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Goal</label>
                    <select
                      className={`${inputClass} mt-1`}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    >
                      <option value="replies">Get replies</option>
                      <option value="meetings">Book meetings</option>
                      <option value="awareness">Build awareness</option>
                      <option value="followup">Follow up</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Value proposition</label>
                    <input
                      className={`${inputClass} mt-1`}
                      value={valueProp}
                      onChange={(e) => setValueProp(e.target.value)}
                      placeholder="What value do you offer?"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        AI draft preview
                      </h4>
                      <p className="text-xs text-slate-500">Preview only; no email is sent.</p>
                    </div>
                    <UptoButton onClick={generateCopy} disabled={copyBusy}>
                      {copyBusy ? "Generating…" : "Generate drafts"}
                    </UptoButton>
                  </div>
                  {variants.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {variants.map((v, index) => (
                        <button
                          type="button"
                          key={v.id ?? index}
                          onClick={() => setSelectedVariant(v.id ?? "")}
                          className={
                            "rounded-xl border p-3.5 text-left transition " +
                            (selectedVariant === v.id
                              ? "border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 dark:bg-teal-950/30"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-700")
                          }
                        >
                          <span className="text-xs font-semibold text-teal-600">
                            Draft {index + 1}
                            {selectedVariant === v.id ? " · Selected" : ""}
                          </span>
                          <p className="mt-1.5 break-words text-sm font-semibold">{v.subject}</p>
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed">
                            {v.body}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Step 2: Review & Schedule */}
            {step === 2 && (
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <BarChart3 className="h-4 w-4 text-teal-600" /> Review & schedule
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <Users className="h-4 w-4 text-teal-600" />
                    <p className="mt-1.5 text-lg font-bold">{count === null ? "Not scanned" : count}</p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Expected leads from preview.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <p className="mt-1.5 text-sm font-bold">{tone}</p>
                    <p className="text-xs text-slate-500">Tone · goal: {goal}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                    <BarChart3 className="h-4 w-4 text-teal-600" />
                    <p className="mt-1.5 text-sm font-bold">2-Step Sequence</p>
                    <p className="text-xs text-slate-500">Active (Step 1) → Complete (Step 2)</p>
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className={labelClass}>Scheduled date & time</label>
                  <input
                    className={`${inputClass} mt-1`}
                    type="datetime-local"
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700 space-y-1">
                  <p>
                    <b>Audience:</b> {audienceLabel}
                  </p>
                  <p>
                    <b>AI direction:</b> {tone} tone · {goal}
                  </p>
                  <p>
                    <b>Drafts status:</b>{" "}
                    {variants.length > 0 ? (
                      <span className="text-emerald-600 font-semibold dark:text-emerald-400">
                        {variants.length} draft(s) generated
                      </span>
                    ) : (
                      <span className="text-rose-500 font-semibold">Not generated yet</span>
                    )}
                  </p>
                  <p>
                    <b>Schedule:</b> {schedule || "Not set"}
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Footer - Previous & Next Navigation */}
          <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 sm:px-8 py-4 dark:border-slate-800 dark:bg-slate-900/60 shrink-0">
            <span className="text-xs text-slate-500">Step {step + 1} of 3</span>
            
            <div className="flex items-center gap-3">
              {step > 0 && (
                <UptoButton
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft className="mr-1.5 inline h-3.5 w-3.5" /> Previous step
                </UptoButton>
              )}

              {step < 2 ? (
                <UptoButton
                  onClick={() => {
                    if (step === 0 && count === null) {
                      toast.error("Preview the audience before continuing.");
                      return;
                    }
                    setStep(step + 1);
                  }}
                >
                  Next step <ArrowRight className="ml-1.5 inline h-3.5 w-3.5" />
                </UptoButton>
              ) : (
                <UptoButton disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save scheduled campaign"}
                </UptoButton>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}