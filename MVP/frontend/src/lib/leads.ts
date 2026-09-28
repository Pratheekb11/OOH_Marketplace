import api from "./api";

/** Mirrors MVP/backend LeadCreate. */
export interface LeadInput {
  name: string;
  phone: string;
  reason: string;
  source?: string;
  listing_id?: number;
}

export interface LeadOut extends LeadInput {
  id: number;
  crm_status: string;
  created_at: string;
}

export function submitLead(input: LeadInput): Promise<LeadOut> {
  return api<LeadOut>("/leads", { method: "POST", body: JSON.stringify(input) });
}
