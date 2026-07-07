import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "support.json");

export type TicketStatus = "new" | "answered" | "resolved";
export type TicketCategory = "question" | "bug" | "account" | "billing" | "feature" | "other";
export type TicketSeverity = "low" | "medium" | "high";

export type SupportTicket = {
  id: string;
  ownerId: string; // user id who submitted
  userName: string;
  userEmail: string;
  userRole: string;
  subject: string;
  message: string;
  createdAt: string;
  status: TicketStatus;
  // AI triage (internal — dispatcher never sees these)
  category?: TicketCategory;
  severity?: TicketSeverity;
  aiReport?: string; // internal analysis + suggested fix for the admin
  aiDraftReply?: string; // suggested reply to the dispatcher
  aiAt?: string;
  // admin action
  reply?: string; // the reply actually sent to the dispatcher
  repliedAt?: string;
  repliedBy?: string;
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]", "utf8");
}

export function getAllTickets(): SupportTicket[] {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as SupportTicket[];
  } catch {
    return [];
  }
}

function save(tickets: SupportTicket[]) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(tickets, null, 2), "utf8");
}

export function createTicket(fields: {
  ownerId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  subject: string;
  message: string;
}): SupportTicket {
  const tickets = getAllTickets();
  const t: SupportTicket = {
    id: crypto.randomUUID(),
    ownerId: fields.ownerId,
    userName: fields.userName,
    userEmail: fields.userEmail,
    userRole: fields.userRole,
    subject: fields.subject.trim().slice(0, 140),
    message: fields.message.trim().slice(0, 4000),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  tickets.push(t);
  save(tickets);
  return t;
}

export function getTicketsByOwner(ownerId: string): SupportTicket[] {
  return getAllTickets()
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getTicket(id: string): SupportTicket | undefined {
  return getAllTickets().find((t) => t.id === id);
}

export function updateTicket(id: string, patch: Partial<SupportTicket>): SupportTicket | undefined {
  const tickets = getAllTickets();
  const t = tickets.find((x) => x.id === id);
  if (!t) return undefined;
  Object.assign(t, patch);
  save(tickets);
  return t;
}
