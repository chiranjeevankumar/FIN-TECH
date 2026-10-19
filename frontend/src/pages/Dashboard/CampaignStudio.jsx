import React, { useEffect, useMemo, useState } from "react";
import { campaignService, leadService, tagService, savedSearchService } from "@/services";
import { UptoButton, UptoCard } from "@/components/UI/UptoHooks";
import { ArrowLeft, ArrowRight, Sparkles, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const statuses = ["new", "contacted", "qualified", "in_progress", "converted", "closed", "lost"];
const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800";
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

  const generateCopy = async () => {
    if (count === null) {
      toast.error("Preview the audience before generating drafts.");
      return;
    }
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
      setSelectedVariant(data.variants[0].id);
      toast.success("Drafts generated. Review them before scheduling.");
    } catch (e) {
      toast.error(e?.message || "Could not generate email drafts");
    } finally {
      setCopyBusy(false);
    }
  };

  const [count, setCount] = useState(null);
  const [sample, setSample] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([tagService.list().catch(() => []), savedSearchService.list({resource:"leads"}).catch(() => [])]).then(([a,b]) => {
      setTags(Array.isArray(a) ? a : a?.tags || a?.items || a?.data || []);
      setSegments(Array.isArray(b) ? b : b?.items || b?.savedSearches || b?.data || []);
    });
  }, []);
  const audience = useMemo(() => type === "status" ? {type, status} : type === "score" ? {type, operator:"between", min:Number(min), max:Number(max)} : type === "tag" ? {type, tagId:Number(tagId)} : type === "segment" ? {type, savedSearchId:Number(segmentId)} : {type:"all"}, [type,status,min,max,tagId,segmentId]);
  const audienceLabel = type === "all" ? "All Leads" : type === "status" ? "Status: "+status : type === "score" ? "Lead score "+min+"–"+max : type === "tag" ? "Tag: "+(tags.find(t=>String(t.id)===String(tagId))?.name || "selected") : "Saved segment: "+(segments.find(s=>String(s.id)===String(segmentId))?.name || "selected");
  const scan = async () => {
    if (type === "tag" && !tagId) {
      toast.error("Select a tag first");
      return;
    }
    if (type === "segment" && !segmentId) {
      toast.error("Select a saved segment first");
      return;
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
      toast.error("Choose a valid score range from 0 to 100");
      return;
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


  const save = async () => {
    if (!name.trim()) return toast.error("Enter a campaign name");
    if (!schedule || new Date(schedule) <= new Date()) return toast.error("Choose a future schedule");
    if (type==="tag" && !tagId) return toast.error("Select a tag");
    if (type==="segment" && !segmentId) return toast.error("Select a saved segment");
    if (type === "score" && (min === "" || max === "" || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max)) || Number(min) < 0 || Number(max) > 100 || Number(min) > Number(max))) return toast.error("Choose a valid score range from 0 to 100");
    setBusy(true);
    try {
      if (count === null) {
        toast.error("Preview the audience before saving to confirm expected leads.");
        return;
      }

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
      onSaved?.(); onClose?.();
    } catch(e) { toast.error(e?.message || "Could not save campaign"); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 p-3 dark:bg-slate-950 sm:p-6"><div className="mx-auto max-w-5xl">
    <header className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-600">SALESFORGE · CAMPAIGN STUDIO</p><h2 className="text-2xl font-bold">Create campaign</h2><p className="text-sm text-slate-500">Audience segmentation · AI copy direction · Schedule review</p></div><UptoButton variant="secondary" onClick={onClose}>Back</UptoButton></header>
    <UptoCard><label className="block text-sm font-medium">Campaign name<input className={inputClass} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Q1 Outreach"/></label>
    <nav className="my-5 flex flex-wrap gap-2">{["1 · Audience","2 · Personalization","3 · Review"].map((x,i)=><button type="button" key={x} onClick={()=>{if(i>0 && count === null){toast.error("Preview the audience before continuing.");return;}setStep(i)}} className={"rounded-full px-4 py-2 text-sm "+(step===i?"bg-teal-600 text-white":"bg-slate-100 dark:bg-slate-800")}>{x}</button>)}</nav>
    {step===0 && <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Users className="text-teal-600"/>Define target audience</h3><div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Audience<select className={inputClass} value={type} onChange={e=>{setType(e.target.value);setCount(null);setSample([])}}><option value="all">All Leads</option><option value="status">By Status</option><option value="tag">By Tag</option><option value="segment">By Saved Segment</option><option value="score">By Lead Score</option></select></label>
    {type==="status"&&<label className="text-sm">Status<select className={inputClass} value={status} onChange={e=>{setStatus(e.target.value);setCount(null);setSample([])}}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>}
    {type==="tag"&&<label className="text-sm">Tag<select className={inputClass} value={tagId} onChange={e=>{setTagId(e.target.value);setCount(null);setSample([])}}><option value="">Choose tag</option>{tags.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
    {type==="segment"&&<label className="text-sm">Saved segment<select className={inputClass} value={segmentId} onChange={e=>{setSegmentId(e.target.value);setCount(null);setSample([])}}><option value="">Choose segment</option>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {type==="score"&&<div className="grid grid-cols-2 gap-3"><label className="text-sm">Min score<input className={inputClass} type="number" min="0" max="100" value={min} onChange={e=>{setMin(e.target.value);setCount(null);setSample([])}}/></label><label className="text-sm">Max score<input className={inputClass} type="number" min="0" max="100" value={max} onChange={e=>{setMax(e.target.value);setCount(null);setSample([])}}/></label></div>}
    <div className="rounded-xl border p-4 dark:border-slate-700"><h4 className="font-semibold">Audience preview</h4><p className="mt-1 text-sm text-slate-500">{audienceLabel}</p><UptoButton onClick={scan} disabled={busy}>{busy?"Scanning…":"Scan & Preview Segment"}</UptoButton>{count!==null&&<div className="mt-3"><p className="text-2xl font-bold">{count}</p><p className="text-xs text-slate-500">Matching leads returned by current lead API query</p>{sample.map(l=><p key={l.id} className="mt-1 text-xs">{l.name||"Unnamed"} · {l.companyName||"No company"} · Score {l.score??"—"}</p>)}</div>}</div></div></section>}
    {step===1&&<section><h3 className="mb-4 flex items-center gap-2 font-semibold"><Sparkles className="text-teal-600"/>AI copy studio</h3><p className="mb-4 text-sm text-slate-500">Set the direction only. No fixed subject or body is stored: Gemini generates a fresh subject and personalized email for each lead when the campaign sends.</p><div className="mb-4"><label className="text-sm font-medium">Prompt or keywords<input className={inputClass} value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1000} placeholder="e.g. introduce our CRM, highlight time savings, ask for a short meeting"/></label><p className="mt-1 text-xs text-slate-500">Gemini uses this direction together with your audience, campaign goal, and tone.</p></div><div className="grid gap-4 md:grid-cols-3"><label className="text-sm">Tone<select className={inputClass} value={tone} onChange={e=>setTone(e.target.value)}><option value="professional">Professional</option><option value="conversational">Conversational</option><option value="concise">Concise</option></select></label><label className="text-sm">Goal<select className={inputClass} value={goal} onChange={e=>setGoal(e.target.value)}><option value="replies">Get replies</option><option value="meetings">Book meetings</option><option value="awareness">Build awareness</option><option value="followup">Follow up</option></select></label><label className="text-sm">Value proposition<input className={inputClass} value={valueProp} onChange={e=>setValueProp(e.target.value)} placeholder="What value do you offer?"/></label></div><div className="mt-4 rounded-xl border p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-semibold">AI draft preview</h4>
        <p className="text-xs text-slate-500">Two drafts for review. Preview only; no email is sent.</p></div>
        <UptoButton onClick={generateCopy} disabled={copyBusy}>
          {copyBusy ? "Generating…" : "Generate 2 drafts"}
        </UptoButton>
      </div>
      {variants.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">
        {variants.map(v => <button type="button" key={v.id}
          onClick={() => setSelectedVariant(v.id)}
          className={"rounded-xl border p-3 text-left " +
            (selectedVariant === v.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200 dark:border-slate-700")}>
          <span className="text-xs font-semibold text-teal-600">Draft {v.id}{selectedVariant === v.id ? " · Selected" : ""}</span>
          <p className="mt-2 text-sm font-semibold">{v.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-xs">{v.body}</p>
        </button>)}
      </div>}
    </div><div className="mt-4 rounded-xl border p-4 text-sm dark:border-slate-700"><h4 className="font-semibold">Send-time personalization</h4><p className="mt-2 text-slate-500">Gemini will use each lead’s name, company, job title, industry, location, status, score, selected audience, and this campaign direction to generate the subject and body immediately before sending. The campaign stores no fixed email copy.</p></div></section>}
    {step===2&&<section><h3 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="text-teal-600"/>Review & schedule</h3><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><Users/><p className="mt-2 text-xl font-bold">{count===null?"Not scanned":count}</p><p className="text-xs text-slate-500">Expected leads from the live audience preview. Enrollment is rechecked against these conditions when the campaign starts.</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><Sparkles/><p className="mt-2 font-bold">{tone}</p><p className="text-xs text-slate-500">Tone · goal: {goal}</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><BarChart3/><p className="mt-2 font-bold">No prediction available</p><p className="text-xs text-slate-500">Open/click predictions require validated model or historical data</p></div></div><label className="mt-4 block max-w-md text-sm">Scheduled date & time<input className={inputClass} type="datetime-local" min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={schedule} onChange={e=>setSchedule(e.target.value)}/></label><div className="mt-4 rounded-xl border p-4 text-sm dark:border-slate-700"><b>Audience:</b> {audienceLabel}<br/><b>AI direction:</b> {tone} tone · {goal}<br/><b>Schedule:</b> {schedule||"Not set"}</div></section>}
    <footer className="mt-6 flex justify-between border-t pt-4 dark:border-slate-700"><UptoButton variant="secondary" onClick={()=>step===0?onClose?.():setStep(step-1)}><ArrowLeft className="mr-1 inline h-4 w-4"/>{step===0?"Cancel":"Previous"}</UptoButton>{step<2?<UptoButton onClick={()=>{if (step === 0 && count === null) { toast.error("Preview the audience before continuing."); return; } setStep(step+1)}}>Next step <ArrowRight className="ml-1 inline h-4 w-4"/></UptoButton>:<UptoButton disabled={busy} onClick={save}>{busy?"Saving…":"Save scheduled campaign"}</UptoButton>}</footer>
    <p className="mt-3 text-xs text-slate-500">The campaign is scheduled, not sent immediately. Delivery requires the backend scheduler, Gemini API key, SMTP credentials, and eligible leads at send time.</p></UptoCard></div></div>;
}
