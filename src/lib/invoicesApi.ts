// src/lib/invoicesApi.ts
import { api } from "./api"; // <- your axios instance

export type InvoiceItem = {
  refType: "ride";
  refId: string;
  description: string;
  amount: number;
  taxAmount: number;
  total: number;
  meta?: any;
};

export type Invoice = {
  _id: string;
  type: "ride" | "monthly";
  invoiceNo: string;
  companyId: string;
  rideId?: string;
  issuedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  status: "issued" | "paid" | "void";
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  pdfPath?: string;
  items: InvoiceItem[];
};

/* -------------------- single invoice -------------------- */
export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${invoiceId}`);
  return data.invoice;
}

/* -------------------- list invoices -------------------- */
export async function listInvoices(params: {
  companyId?: string;
  type?: "ride" | "monthly";
  month?: number;
  year?: number;
}): Promise<Invoice[]> {
  const { data } = await api.get(`/invoices`, { params });
  return data.invoices;
}

/* -------------------- generate monthly -------------------- */
export async function generateMonthlyInvoice(payload: {
  companyId: string;
  month: number;
  year: number;
}): Promise<Invoice> {
  const { data } = await api.post(`/invoices/monthly/generate`, payload);
  return data.invoice;
}

/* -------------------- open / download pdf -------------------- */
export function openInvoicePdf(invoiceId: string) {
  const url = `${import.meta.env.VITE_API_BASE_URL}/invoices/${invoiceId}/pdf`;
  window.open(url, "_blank", "noopener,noreferrer");
}
