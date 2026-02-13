// src/lib/geoApi.ts

const API_BASE = import.meta.env.VITE_API_BASE_URL;
export type OlaSuggestion = {
  label: string;
  place_id: string | null;
  lat: number;
  lng: number;
};

export async function geoAutocomplete(params: {
  input: string;
  location?: string;
  radius?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  qs.set("input", params.input);
  if (params.location) qs.set("location", params.location);
  if (params.radius) qs.set("radius", String(params.radius));
  if (params.limit) qs.set("limit", String(params.limit));

  const resp = await fetch(
    `${API_BASE}api/geo/autocomplete?${qs.toString()}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await resp.json().catch(() => null);

  if (!resp.ok || !data?.ok) {
    throw new Error(data?.error || "Geo autocomplete failed");
  }

  return data as { ok: true; provider: "ola"; items: OlaSuggestion[] };
}
