import React from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, BarChart3, CalendarDays, CheckCircle2,
  CircleHelp, Globe2, Mail, Search, Sparkles, Target, Users,
} from "lucide-react";

const metrics = [
  { label: "Total Leads", value: "1,284", note: "+12.8% this month", icon: Users },
  { label: "Qualified", value: "846", note: "Sample pipeline", icon: Target },
  { label: "Converted", value: "216", note: "16.8% conversion", icon: CheckCircle2 },
  { label: "New This Week", value: "74", note: "Illustrative activity", icon: Activity },
];

const activity = [
  { title: "New lead list created", detail: "Example activity · Today, 10:30 AM", status: "Completed" },
  { title: "Campaign draft prepared", detail: "Example activity · Yesterday", status: "Draft" },
  { title: "Weekly performance report", detail: "Example activity · Oct 14", status: "Ready" },
];

const tools = [
  { title: "Email Search", description: "Explore a sample lead-finding workflow.", icon: Mail },
  { title: "Domain Search", description: "See how company-domain research is presented.", icon: Globe2 },
  { title: "Database Search", description: "Preview search and lead discovery tools.", icon: Search },
  { title: "Analytics & Reports", description: "Review example performance visualizations.", icon: BarChart3 },
];

export default function PublicDemoDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3 font-bold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-600 text-white">FS</span>
            <span>FIN-TECH <span className="font-normal text-slate-500">/ Preview</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 sm:inline-flex">DEMO DATA</span>
            <Link to="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">Home</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 md:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-950 p-7 text-white md:p-10">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-100">
              <Sparkles className="h-4 w-4" /> Public product preview
            </div>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">Your sales workspace, at a glance.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              Explore the FIN-TECH dashboard layout, sample performance cards, activity, and tools without creating an account.
              Every number and activity on this page is illustrative—not live customer data.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#tools" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-50">Explore tools <ArrowRight className="h-4 w-4" /></a>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm text-slate-100"><CircleHelp className="h-4 w-4" /> Read-only preview</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="performance-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Overview</p><h2 id="performance-heading" className="mt-1 text-2xl font-bold">Performance snapshot</h2></div>
            <p className="text-sm text-slate-500">Illustrative sample metrics</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, note, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span><span className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Icon className="h-5 w-5" /></span></div>
                <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-bold">Lead pipeline</h2><p className="mt-1 text-sm text-slate-500">Example distribution only</p></div><BarChart3 className="h-5 w-5 text-teal-600" /></div>
            <div className="space-y-5">
              {[["New", 82, "bg-sky-500"], ["Qualified", 66, "bg-teal-500"], ["Proposal", 43, "bg-violet-500"], ["Converted", 28, "bg-emerald-500"]].map(([label, width, color]) => (
                <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-slate-500">{width}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">Recent activity</h2><p className="mt-1 text-sm text-slate-500">Sample entries</p></div><CalendarDays className="h-5 w-5 text-violet-600" /></div>
            <div className="space-y-4">{activity.map((item) => <div key={item.title} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0 dark:border-slate-800"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.status}</span></div></div>)}</div>
          </article>
        </section>

        <section id="tools">
          <div className="mb-4"><p className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Explore</p><h2 className="mt-1 text-2xl font-bold">Tools & capabilities</h2><p className="mt-2 text-sm text-slate-500">These cards demonstrate the product experience; they do not run searches or change live records.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tools.map(({ title, description, icon: Icon }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className="mb-4 inline-flex rounded-xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Icon className="h-5 w-5" /></span><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></article>)}</div>
        </section>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
          Public preview · Sample data only · No login required
        </footer>
      </main>
    </div>
  );
}
