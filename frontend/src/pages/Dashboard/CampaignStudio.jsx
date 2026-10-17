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
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(0);
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
      (!Number.isFinite(Number(min)) ||
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

  const generateDrafts = async () => {
    if (!prompt.trim()) return toast.error("Enter a prompt or keywords first");
    if (count === null) return toast.error("Preview the audience before generating drafts");
    setBusy(true);
    try {
      const result = await campaignService.generateDrafts({ campaignName: name.trim(), prompt: prompt.trim(), tone, goal, valueProposition: valueProp.trim(), audienceLabel, lead: sample[0] || null });
      const payload = result?.data ?? result;
      if (!Array.isArray(payload?.drafts) || payload.drafts.length !== 2) throw new Error("Gemini did not return two valid drafts");
      setDrafts(payload.drafts);
      setSelectedDraft(0);
      toast.success("Two Gemini draft options are ready to compare");
    } catch (e) { toast.error(e?.message || "Unable to generate drafts"); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Enter a campaign name");
    if (!schedule || new Date(schedule) <= new Date()) return toast.error("Choose a future schedule");
    if (drafts.length !== 2) return toast.error("Generate and review both Gemini drafts first");
    if (type==="tag" && !tagId) return toast.error("Select a tag");
    if (type==="segment" && !segmentId) return toast.error("Select a saved segment");
    if (Number(min)>Number(max) || Number(min)<0 || Number(max)>100) return toast.error("Choose a valid score range from 0 to 100");
    setBusy(true);
    try {
      await campaignService.create({
        name:name.trim(),
        description:"Campaign goal: "+goal+". Copy tone: "+tone+". Value proposition: "+valueProp.trim()+". Prompt: "+prompt.trim()+". Selected Gemini draft: "+(selectedDraft+1),
        content:[{type:"SEND_EMAIL",subject:drafts[selectedDraft].subject,body:drafts[selectedDraft].body,approvedDraftIndex:selectedDraft+1,prompt:prompt.trim(),tone,goal,valueProposition:valueProp.trim()}],
        audience,
        schedule:new Date(schedule).toISOString(),
        type:"email",
        steps:[{day:0,time:new Date(schedule).toTimeString().slice(0,5)}]
      });
      toast.success("Campaign saved as scheduled. Sending still depends on the existing scheduler.");
      onSaved?.(); onClose?.();
    } catch(e) { toast.error(e?.message || "Could not save campaign"); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 p-3 dark:bg-slate-950 sm:p-6"><div className="mx-auto max-w-5xl">
    <header className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-600">SALESFORGE · CAMPAIGN STUDIO</p><h2 className="text-2xl font-bold">Create campaign</h2><p className="text-sm text-slate-500">Audience segmentation · AI copy direction · Schedule review</p></div><UptoButton variant="secondary" onClick={onClose}>Back</UptoButton></header>
    <UptoCard><label className="block text-sm font-medium">Campaign name<input className={inputClass} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Q1 Outreach"/></label>
    <nav className="my-5 flex flex-wrap gap-2">{["1 · Audience","2 · AI copy","3 · Review"].map((x,i)=><button type="button" key={x} onClick={()=>setStep(i)} className={"rounded-full px-4 py-2 text-sm "+(step===i?"bg-teal-600 text-white":"bg-slate-100 dark:bg-slate-800")}>{x}</button>)}</nav>
    {step===0 && <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Users className="text-teal-600"/>Define target audience</h3><div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Audience<select className={inputClass} value={type} onChange={e=>{setType(e.target.value);setCount(null)}}><option value="all">All Leads</option><option value="status">By Status</option><option value="tag">By Tag</option><option value="segment">By Saved Segment</option><option value="score">By Lead Score</option></select></label>
    {type==="status"&&<label className="text-sm">Status<select className={inputClass} value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>}
    {type==="tag"&&<label className="text-sm">Tag<select className={inputClass} value={tagId} onChange={e=>setTagId(e.target.value)}><option value="">Choose tag</option>{tags.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
    {type==="segment"&&<label className="text-sm">Saved segment<select className={inputClass} value={segmentId} onChange={e=>setSegmentId(e.target.value)}><option value="">Choose segment</option>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {type==="score"&&<div className="grid grid-cols-2 gap-3"><label className="text-sm">Min score<input className={inputClass} type="number" min="0" max="100" value={min} onChange={e=>setMin(e.target.value)}/></label><label className="text-sm">Max score<input className={inputClass} type="number" min="0" max="100" value={max} onChange={e=>setMax(e.target.value)}/></label></div>}
    <div className="rounded-xl border p-4 dark:border-slate-700"><h4 className="font-semibold">Audience preview</h4><p className="mt-1 text-sm text-slate-500">{audienceLabel}</p><UptoButton onClick={scan} disabled={busy}>{busy?"Scanning…":"Scan & Preview Segment"}</UptoButton>{count!==null&&<div className="mt-3"><p className="text-2xl font-bold">{count}</p><p className="text-xs text-slate-500">Matching leads returned by current lead API query</p>{sample.map(l=><p key={l.id} className="mt-1 text-xs">{l.name||"Unnamed"} · {l.companyName||"No company"} · Score {l.score??"—"}</p>)}</div>}</div></div></section>}
    {step===1&&<section><h3 className="mb-4 flex items-center gap-2 font-semibold"><Sparkles className="text-teal-600"/>AI copy studio</h3><p className="mb-4 text-sm text-slate-500">Describe your offer and keywords. Gemini will create two alternatives for you to compare. Generating drafts does not send email.</p><label className="mb-4 block text-sm">Prompt / keywords<textarea className={inputClass+" min-h-24"} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Example: invite SaaS founders to a 15-minute demo; highlight time saved and easy setup; avoid exaggerated claims."/></label><div className="grid gap-4 md:grid-cols-3"><label className="text-sm">Tone<select className={inputClass} value={tone} onChange={e=>setTone(e.target.value)}><option value="professional">Professional</option><option value="conversational">Conversational</option><option value="concise">Concise</option></select></label><label className="text-sm">Goal<select className={inputClass} value={goal} onChange={e=>setGoal(e.target.value)}><option value="replies">Get replies</option><option value="meetings">Book meetings</option><option value="awareness">Build awareness</option><option value="followup">Follow up</option></select></label><label className="text-sm">Value proposition<input className={inputClass} value={valueProp} onChange={e=>setValueProp(e.target.value)} placeholder="What value do you offer?"/></label></div><div className="mt-4"><UptoButton disabled={busy||count===null} onClick={generateDrafts}>{busy?"Generating…":"Generate 2 Gemini drafts"}</UptoButton></div>{drafts.length===2&&<div className="mt-5 grid gap-4 md:grid-cols-2">{drafts.map((draft,i)=><button type="button" key={i} onClick={()=>setSelectedDraft(i)} className={"rounded-xl border p-4 text-left "+(selectedDraft===i?"border-teal-500 ring-2 ring-teal-500":"border-slate-200 dark:border-slate-700")}><div className="mb-2 flex items-center justify-between"><b>Option {i+1}</b><span className="text-xs">{selectedDraft===i?"Selected":"Select this draft"}</span></div><p className="font-semibold">{draft.subject}</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{draft.body}</p></button>)}</div>}<p className="mt-4 rounded-xl border p-3 text-sm dark:border-slate-700">The chosen draft is saved with the scheduled campaign for review. This preview does not send email. Confirm backend delivery configuration before launching any real campaign.</p></section>}
    {step===2&&<section><h3 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="text-teal-600"/>Review & schedule</h3><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><Users/><p className="mt-2 text-xl font-bold">{count===null?"Not scanned":count}</p><p className="text-xs text-slate-500">Preview count, not a guaranteed enrollment count</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><Sparkles/><p className="mt-2 font-bold">{tone}</p><p className="text-xs text-slate-500">Tone · goal: {goal}</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><BarChart3/><p className="mt-2 font-bold">No prediction available</p><p className="text-xs text-slate-500">Open/click predictions require validated model or historical data</p></div></div><label className="mt-4 block max-w-md text-sm">Scheduled date & time<input className={inputClass} type="datetime-local" min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={schedule} onChange={e=>setSchedule(e.target.value)}/></label><div className="mt-4 rounded-xl border p-4 text-sm dark:border-slate-700"><b>Audience:</b> {audienceLabel}<br/><b>AI direction:</b> {tone} tone · {goal}<br/><b>Schedule:</b> {schedule||"Not set"}<br/><b>Selected draft:</b> {drafts[selectedDraft]?.subject||"Generate and select a draft first"}</div>{drafts[selectedDraft]&&<div className="mt-4 rounded-xl border p-4 dark:border-slate-700"><h4 className="font-semibold">{drafts[selectedDraft].subject}</h4><p className="mt-2 whitespace-pre-wrap text-sm">{drafts[selectedDraft].body}</p></div>}</section>}
    <footer className="mt-6 flex justify-between border-t pt-4 dark:border-slate-700"><UptoButton variant="secondary" onClick={()=>step===0?onClose?.():setStep(step-1)}><ArrowLeft className="mr-1 inline h-4 w-4"/>{step===0?"Cancel":"Previous"}</UptoButton>{step<2?<UptoButton onClick={()=>setStep(step+1)}>Next step <ArrowRight className="ml-1 inline h-4 w-4"/></UptoButton>:<UptoButton disabled={busy} onClick={save}>{busy?"Saving…":"Save scheduled campaign"}</UptoButton>}</footer>
    <p className="mt-3 text-xs text-slate-500">Saving does not itself guarantee delivery. Keep the campaign scheduler disabled during testing.</p></UptoCard></div></div>;
}
