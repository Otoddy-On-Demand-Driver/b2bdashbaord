import { useState } from "react";
import { api, apiErrorMessage } from "../../lib/api";

export default function ApiPing() {
  const [out, setOut] = useState<string>("");

  async function ping() {
    try {
      const { data } = await api.get("/healthz");
      setOut(JSON.stringify(data));
    } catch (e: any) {
      setOut(apiErrorMessage(e, "ping failed"));
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={ping}
        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold"
      >
        Test /healthz
      </button>
      {out ? <div className="mt-2 text-xs text-slate-600">{out}</div> : null}
    </div>
  );
}
