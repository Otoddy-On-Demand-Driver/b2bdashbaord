// src/lib/invoicesApi.ts
import { api } from "./api";

export const INVOICE_TYPES = ["ride", "monthly", "period"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = ["issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_REF_TYPES = ["ride", "period"] as const;
export type InvoiceRefType = (typeof INVOICE_REF_TYPES)[number];

export type InvoiceItem = {
  refType: InvoiceRefType; // "ride" | "period"
  refId: string;
  description: string;
  amount: number; // base amount
  taxAmount: number; // tax
  total: number; // amount + tax
  hsnSac?: string;
  meta?: any;
};

export type Invoice = {
  _id: string;
  type: InvoiceType; // "ride" | "monthly" | "period"
  invoiceNo: string;

companyId?: string | null;
  rideId?: string;

  issuedAt?: string;

  // monthly or period range
  periodStart?: string;
  periodEnd?: string;

  status: InvoiceStatus; // "issued" | "paid" | "void"

  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // optional if you implement rounding like U1 invoice
  roundOff?: number;

  pdfPath?: string;
  items: InvoiceItem[];
};

/* -------------------- single invoice -------------------- */
export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${invoiceId}`);
  return data.invoice;
}

/* -------------------- list invoices -------------------- */
export async function listInvoices(params?: any) {
  const { data } = await api.get("/invoices", { params });
  return data?.invoices || [];
}

/* -------------------- generate monthly -------------------- */
export async function generateMonthlyInvoice(payload: {
companyId?: string | null;
  month: number; // 1-12
  year: number;
}): Promise<Invoice> {
  const { data } = await api.post(`/invoices/monthly/generate`, payload);
  return data.invoice;
}

/* -------------------- generate period (date-range single invoice) -------------------- */
export async function generatePeriodInvoice(payload: {
companyId?: string | null;
  startDate: string; // ISO or yyyy-mm-dd
  endDate: string;   // ISO or yyyy-mm-dd
}): Promise<Invoice> {
  const { data } = await api.post(`/invoices/period/generate`, payload);
  return data.invoice;
}

/* -------------------- open / download pdf -------------------- */
export function openInvoicePdf(invoiceId: string) {
  const base = import.meta.env.VITE_API_BASE_URL;
  const url = `${base}invoices/${invoiceId}/pdf`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function generateRideInvoice(payload: { rideId: string; companyId: string }) {
  const { data } = await api.post(`/invoices/ride/generate`, payload);
  return data.invoice as Invoice;
}
