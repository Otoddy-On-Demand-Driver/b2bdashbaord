// src/components/LocationAutocomplete.tsx
import { useEffect, useRef, useState } from "react";
import { geoAutocomplete, type OlaSuggestion } from "../lib/geoApi";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;

  // Called when user selects a suggestion (autofill lat/lng in parent)
  onSelect: (s: OlaSuggestion) => void;

  // optional: bias results near a coordinate (e.g. pickup for drop search)
  biasLocation?: string; // "lat,lng"
  radius?: number;

  inputClassName?: string;
  labelClassName?: string;
  minChars?: number;
  limit?: number;
};

export default function LocationAutocomplete({
  label,
  value,
  onChangeText,
  onSelect,
  biasLocation,
  radius,
  inputClassName = "",
  labelClassName = "",
  minChars = 3,
  limit = 6,
}: Props) {
  const [items, setItems] = useState<OlaSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debounced = useDebouncedValue(value, 350);
  const lastReqIdRef = useRef(0);

  useEffect(() => {
    const q = (debounced || "").trim();
    if (!open) return;

    if (q.length < minChars) {
      setItems([]);
      return;
    }

    const reqId = ++lastReqIdRef.current;
    setLoading(true);

    geoAutocomplete({
      input: q,
      limit,
      location: biasLocation,
      radius: biasLocation ? radius ?? 25000 : undefined,
    })
      .then((res) => {
        if (reqId !== lastReqIdRef.current) return;
        setItems(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => {
        if (reqId !== lastReqIdRef.current) return;
        setItems([]);
      })
      .finally(() => {
        if (reqId !== lastReqIdRef.current) return;
        setLoading(false);
      });
  }, [debounced, open, minChars, limit, biasLocation, radius]);

  function handlePick(s: OlaSuggestion) {
    onSelect(s);
    setItems([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className={labelClassName}>{label}</div>

      <input
        className={inputClassName}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing..."
      />

      {open && (loading || items.length > 0) && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-black/10 bg-white shadow-lg overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-sm text-black/60">Searching...</div>
          )}

          {!loading &&
            items.map((s) => (
              <button
                key={s.place_id ?? s.label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-black/[0.04]"
              >
                <div className="font-semibold text-black/80 line-clamp-1">{s.label}</div>
                <div className="text-xs text-black/50">
                  {s.lat}, {s.lng}
                </div>
              </button>
            ))}

          {!loading && items.length === 0 && (
            <div className="px-4 py-3 text-sm text-black/60">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
