import React, { useEffect, useMemo, useState } from "react";
import { campaignService, tagService, savedSearchService } from "@/services";
import { UptoButton, UptoCard } from "@/components/UI/UptoHooks";
import { ArrowRight, Sparkles, Users, BarChart3, X } from "lucide-react";
import { toast } from "sonner";

const statuses = ["new", "contacted", "qualified", "in_progress", "converted", "closed", "lost"];
const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "block text-xs font-medium text-slate-700 dark:text-slate-200";

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
      savedSearchService.list({ resource: "leads" }).catch(() => [])
    ]).then(([a, b]) => {
      setTags(Array.isArray(a) ? a : a?.tags || a?.items || a?.data || []);
      setSegments(Array.isArray(b) ? b : b?.items || b?.savedSearches || b?.data || []);
    });
  }, []);

  const audience = useMemo(
    () => type === "status"
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

  const audienceLabel = type === "all"
    ? "All Leads"
    : type === "status"
      ? "Status: " + status
      : type === "score"
        ? "Lead score " + min + "–" + max
        : type === "tag"
          ? "Tag: " + (tags.find(t => String(t.id) === String(tagId))?.name || "selected")
          : "Saved segment: " + (segments.find(s => String(s.id) === String(segmentId))?.name || "selected");

  const scan = async () => {
    if (type === "tag" && !tagId) return toast.error("Select a tag first");
    if (type === "segment" && !segmentId) return toast.error("Select a saved segment first");
    if (type === "score" && (min === "" || max === "" || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max)) || Number(min) < 0 || Number(max) > 100 || Number(min) > Number(max))) {
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
        prompt: prompt.trim()
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
    if (!name.trim()) return toast.error("Enter a campaign name");
    if (!schedule || new Date(schedule) <= new Date()) return toast.error("Choose a future schedule");
    if (type === "tag" && !tagId) return toast.error("Select a tag");
    if (type === "segment" && !segmentId) return toast.error("Select a saved segment");
    if (type === "score" && (min === "" || max === "" || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max)) || Number(min) < 0 || Number(max) > 100 || Number(min) > Number(max))) return toast.error("Choose a valid score range from 0 to 100");
    if (count === null) return toast.error("Preview the audience before saving to confirm expected leads.");

    setBusy(true);
    try {
      await campaignService.create({
        name: name.trim(),
        description: [
          "Campaign goal: " + goal + ".",
          "Email tone: " + tone + ".",
          valueProp.trim() ? "Value proposition: " + valueProp.trim() + "." : "",
          prompt.trim() ? "Campaign owner direction: " + prompt.trim() + "." : "",
          "Generate a fresh personalized subject and body with Gemini at send time for each enrolled lead. Do not reuse a fixed subject or body."
        ].filter(Boolean).join(" "),
        audience,
        schedule: new Date(schedule).toISOString(),
        type: "email",
        content: [{ type: "SEND_EMAIL" }],
        steps: [{ day: 0, time: new Date(schedule).toTimeString().slice(0, 5) }]
      });
      toast.success("Campaign scheduled for " + count + " matching leads. Gemini will personalize each email at send time.");
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not save campaign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-800 dark:bg-slate-950 sm:p-3">
      <div className="mx-auto max-w-3xl">
        <header className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-teal-600">SALESFORGE · CAMPAIGN STUDIO</p>
            <h2 className="mt-0.5 text-base font-bold tracking-tight text-slate-900 dark:text-white">Create campaign</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Audience segmentation · AI copy direction · Schedule review</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Campaign Studio" title="Close Campaign Studio" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950">
            <X className="h-4 w-4" />
          </button>
        </header>

        <UptoCard>
          <div className="max-w-xs">
            <label className={labelClass}>
              Campaign name
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 Outreach" />
            </label>
          </div>

          <nav aria-label="Campaign setup steps" className="my-2.5 flex flex-wrap gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-700">
            {["1 · Audience", "2 · Personalization", "3 · Review"].map((x, i) => (
              <button type="button" key={x} onClick={() => {
                if (i > 0 && count === null) {
                  toast.error("Preview the audience before continuing.");
                  return;
                }
                setStep(i);
              }} className={"rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-500/30 " + (step === i ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700")}>
                {x}
              </button>
            ))}
          </nav>

          {step === 0 && (
            <section>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Users className="h-4 w-4 text-teal-600" /> Define target audience</h3>
              <div className="grid min-w-0 grid-cols-1 items-start gap-2.5 md:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">Audience criteria</h4>
                  <label className={labelClass}>Audience
                    <select className={inputClass} value={type} onChange={e => { setType(e.target.value); setCount(null); setSample([]); }}>
                      <option value="all">All Leads</option><option value="status">By Status</option><option value="tag">By Tag</option><option value="segment">By Saved Segment</option><option value="score">By Lead Score</option>
                    </select>
                  </label>
                  {type === "status" && <label className={`${labelClass} mt-3`}>Status<select className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setCount(null); setSample([]); }}>{statuses.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>}
                  {type === "tag" && <label className={`${labelClass} mt-3`}>Tag<select className={inputClass} value={tagId} onChange={e => { setTagId(e.target.value); setCount(null); setSample([]); }}><option value="">Choose tag</option>{tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
                  {type === "segment" && <label className={`${labelClass} mt-3`}>Saved segment<select className={inputClass} value={segmentId} onChange={e => { setSegmentId(e.target.value); setCount(null); setSample([]); }}><option value="">Choose segment</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
                  {type === "score" && <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className={labelClass}>Min score<input className={inputClass} type="number" min="0" max="100" value={min} onChange={e => { setMin(e.target.value); setCount(null); setSample([]); }} /></label>
                    <label className={labelClass}>Max score<input className={inputClass} type="number" min="0" max="100" value={max} onChange={e => { setMax(e.target.value); setCount(null); setSample([]); }} /></label>
                  </div>}
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">Choose which leads should be included in this campaign.</p>
                </div>

                <div className="min-w-0 rounded-xl border border-teal-200 bg-white p-3 shadow-sm dark:border-teal-900 dark:bg-slate-900">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Users className="h-4 w-4" /></div>
                    <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white">Audience preview</h4><p className="text-[11px] text-slate-500">Check the matching leads</p></div>
                  </div>
                  <p className="mb-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{audienceLabel}</p>
                  <UptoButton onClick={scan} disabled={busy}>{busy ? "Scanning…" : "Scan & Preview"}</UptoButton>
                  {count !== null && <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-700">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{count}</p>
                    <p className="text-[11px] text-slate-500">Matching leads from the current preview</p>
                    {sample.length > 0 && <div className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">{sample.map(l => <p key={l.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{l.name || "Unnamed"} · {l.companyName || "No company"} · Score {l.score ?? "—"}</p>)}</div>}
                  </div>}
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Sparkles className="h-4 w-4 text-teal-600" /> AI copy studio</h3>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">Set the direction only. Gemini generates a fresh subject and personalized email for each lead when the campaign sends.</p>
              <div className="mb-3 max-w-xl">
                <label className={labelClass}>Prompt or keywords<input className={inputClass} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={1000} placeholder="e.g. introduce our CRM, highlight time savings, ask for a short meeting" /></label>
                <p className="mt-1 text-[11px] text-slate-500">Gemini uses this direction together with your audience, campaign goal, and tone.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className={labelClass}>Tone<select className={inputClass} value={tone} onChange={e => setTone(e.target.value)}><option value="professional">Professional</option><option value="conversational">Conversational</option><option value="concise">Concise</option></select></label>
                <label className={labelClass}>Goal<select className={inputClass} value={goal} onChange={e => setGoal(e.target.value)}><option value="replies">Get replies</option><option value="meetings">Book meetings</option><option value="awareness">Build awareness</option><option value="followup">Follow up</option></select></label>
                <label className={labelClass}>Value proposition<input className={inputClass} value={valueProp} onChange={e => setValueProp(e.target.value)} placeholder="What value do you offer?" /></label>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white">AI draft preview</h4><p className="text-[11px] text-slate-500">Preview only; no email is sent.</p></div>
                  <UptoButton onClick={generateCopy} disabled={copyBusy}>{copyBusy ? "Generating…" : "Generate drafts"}</UptoButton>
                </div>
                {variants.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2">{variants.map((v, index) => <button type="button" key={v.id ?? index} onClick={() => setSelectedVariant(v.id ?? "")} className={"rounded-xl border p-3 text-left transition " + (selectedVariant === v.id ? "border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 dark:bg-teal-950/30" : "border-slate-200 hover:border-slate-300 dark:border-slate-700")}><span className="text-[11px] font-semibold text-teal-600">Draft {index + 1}{selectedVariant === v.id ? " · Selected" : ""}</span><p className="mt-1.5 break-words text-sm font-semibold">{v.subject}</p><p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed">{v.body}</p></button>)}</div>}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50"><h4 className="font-semibold">Send-time personalization</h4><p className="mt-1.5 leading-relaxed text-slate-500">Gemini uses each lead’s details and this campaign direction to generate the subject and body immediately before sending. The campaign stores no fixed email copy.</p></div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><BarChart3 className="h-4 w-4 text-teal-600" /> Review & schedule</h3>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><Users className="h-4 w-4 text-teal-600" /><p className="mt-1.5 text-lg font-bold">{count === null ? "Not scanned" : count}</p><p className="text-[11px] leading-relaxed text-slate-500">Expected leads from the live audience preview.</p></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><Sparkles className="h-4 w-4 text-teal-600" /><p className="mt-1.5 text-sm font-bold">{tone}</p><p className="text-[11px] text-slate-500">Tone · goal: {goal}</p></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><BarChart3 className="h-4 w-4 text-teal-600" /><p className="mt-1.5 text-sm font-bold">No prediction available</p><p className="text-[11px] text-slate-500">Predictions need validated historical data.</p></div>
              </div>
              <label className={`${labelClass} mt-3 block max-w-sm`}>Scheduled date & time<input className={inputClass} type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={schedule} onChange={e => setSchedule(e.target.value)} /></label>
              <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700"><p><b>Audience:</b> {audienceLabel}</p><p className="mt-1"><b>AI direction:</b> {tone} tone · {goal}</p><p className="mt-1"><b>Schedule:</b> {schedule || "Not set"}</p></div>
            </section>
          )}

          <footer className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-2.5 dark:border-slate-700">
            <span className="text-[11px] text-slate-500">Step {step + 1} of 3</span>
            {step < 2
              ? <UptoButton onClick={() => { if (step === 0 && count === null) { toast.error("Preview the audience before continuing."); return; } setStep(step + 1); }}>Next step <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></UptoButton>
              : <UptoButton disabled={busy} onClick={save}>{busy ? "Saving…" : "Save scheduled campaign"}</UptoButton>}
          </footer>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">This schedules the campaign; it does not send immediately. Delivery requires the backend scheduler, Gemini API key, SMTP credentials, and eligible leads.</p>
        </UptoCard>
      </div>
    </div>
  );
}
