// Data access layer. Uses Supabase when configured; otherwise an in-memory
// dev store so the funnel runs locally with zero setup (data lost on restart).
import { randomUUID } from "node:crypto";
import { serviceClient } from "./supabase";
import type { FullReport, ScanStatus } from "./types";

export interface Lead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  sms_consent: boolean;
  qualifier: string | null;
  url: string;
  domain: string;
  ip: string | null;
}

export interface Scan {
  id: string;
  lead_id: string | null;
  url: string;
  domain: string;
  status: ScanStatus;
  step: string | null;
  progress: number;
  report: FullReport | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Store {
  createLead(lead: Omit<Lead, "id" | "first_name" | "last_name" | "phone" | "sms_consent" | "qualifier">): Promise<Lead>;
  updateLead(id: string, fields: Partial<Lead>): Promise<void>;
  createScan(scan: Pick<Scan, "lead_id" | "url" | "domain" | "status" | "step" | "progress" | "report" | "completed_at">): Promise<Scan>;
  updateScan(id: string, fields: Partial<Scan>): Promise<void>;
  getScan(id: string): Promise<Scan | null>;
  getLeadForScan(scanId: string): Promise<Lead | null>;
  countRecentByIp(ip: string, sinceIso: string): Promise<number>;
  countScansSince(sinceIso: string): Promise<number>;
  recordRateEvents(ip: string, email: string): Promise<void>;
  findCachedReport(domain: string, sinceIso: string): Promise<FullReport | null>;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------- Supabase implementation ----------

const supabaseStore: Store = {
  async createLead(lead) {
    const db = serviceClient();
    const { data, error } = await db.from("leads").insert(lead).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create lead");
    return data as Lead;
  },
  async updateLead(id, fields) {
    const db = serviceClient();
    await db.from("leads").update(fields).eq("id", id);
  },
  async createScan(scan) {
    const db = serviceClient();
    const { data, error } = await db.from("scans").insert(scan).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create scan");
    return data as Scan;
  },
  async updateScan(id, fields) {
    const db = serviceClient();
    await db.from("scans").update(fields).eq("id", id);
  },
  async getScan(id) {
    const db = serviceClient();
    const { data } = await db.from("scans").select("*").eq("id", id).maybeSingle();
    return (data as Scan) ?? null;
  },
  async getLeadForScan(scanId) {
    const db = serviceClient();
    const { data: scan } = await db.from("scans").select("lead_id").eq("id", scanId).maybeSingle();
    if (!scan?.lead_id) return null;
    const { data: lead } = await db.from("leads").select("*").eq("id", scan.lead_id).maybeSingle();
    return (lead as Lead) ?? null;
  },
  async countRecentByIp(ip, sinceIso) {
    const db = serviceClient();
    const { count } = await db
      .from("rate_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "ip")
      .eq("key", ip)
      .gte("created_at", sinceIso);
    return count ?? 0;
  },
  async countScansSince(sinceIso) {
    const db = serviceClient();
    const { count } = await db
      .from("scans")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso);
    return count ?? 0;
  },
  async recordRateEvents(ip, email) {
    const db = serviceClient();
    await db.from("rate_events").insert([
      { kind: "ip", key: ip },
      { kind: "email", key: email.toLowerCase() },
    ]);
  },
  async findCachedReport(domain, sinceIso) {
    const db = serviceClient();
    const { data } = await db
      .from("scans")
      .select("report")
      .eq("domain", domain)
      .eq("status", "done")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.report as FullReport) ?? null;
  },
};

// ---------- In-memory dev implementation ----------

// Survives module reloads within one dev-server process via globalThis.
interface MemState {
  leads: Map<string, Lead>;
  scans: Map<string, Scan>;
  rate: { kind: string; key: string; at: number }[];
}
const g = globalThis as unknown as { __aishMem?: MemState };
const initial: MemState = { leads: new Map(), scans: new Map(), rate: [] };
const mem: MemState = g.__aishMem ?? (g.__aishMem = initial);

const memoryStore: Store = {
  async createLead(lead) {
    const full: Lead = {
      id: randomUUID(),
      first_name: null,
      last_name: null,
      phone: null,
      sms_consent: false,
      qualifier: null,
      ...lead,
    };
    mem.leads.set(full.id, full);
    return full;
  },
  async updateLead(id, fields) {
    const lead = mem.leads.get(id);
    if (lead) Object.assign(lead, fields);
  },
  async createScan(scan) {
    const full: Scan = {
      id: randomUUID(),
      error: null,
      created_at: new Date().toISOString(),
      ...scan,
    };
    mem.scans.set(full.id, full);
    return full;
  },
  async updateScan(id, fields) {
    const scan = mem.scans.get(id);
    if (scan) Object.assign(scan, fields);
  },
  async getScan(id) {
    return mem.scans.get(id) ?? null;
  },
  async getLeadForScan(scanId) {
    const scan = mem.scans.get(scanId);
    if (!scan?.lead_id) return null;
    return mem.leads.get(scan.lead_id) ?? null;
  },
  async countRecentByIp(ip, sinceIso) {
    const since = Date.parse(sinceIso);
    return mem.rate.filter((r) => r.kind === "ip" && r.key === ip && r.at >= since).length;
  },
  async countScansSince(sinceIso) {
    const since = Date.parse(sinceIso);
    return [...mem.scans.values()].filter((s) => Date.parse(s.created_at) >= since).length;
  },
  async recordRateEvents(ip, email) {
    const at = Date.now();
    mem.rate.push({ kind: "ip", key: ip, at }, { kind: "email", key: email.toLowerCase(), at });
  },
  async findCachedReport(domain, sinceIso) {
    const since = Date.parse(sinceIso);
    const match = [...mem.scans.values()]
      .filter((s) => s.domain === domain && s.status === "done" && s.report && Date.parse(s.created_at) >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return match?.report ?? null;
  },
};

let warned = false;
export function store(): Store {
  if (supabaseConfigured()) return supabaseStore;
  if (!warned) {
    console.warn("[store] Supabase not configured — using in-memory dev store (data lost on restart)");
    warned = true;
  }
  return memoryStore;
}
