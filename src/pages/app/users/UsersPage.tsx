// src/pages/app/users/UsersPage.tsx
import { useMemo, useState } from "react";
import { api, apiErrorMessage } from "../../../lib/api";

type Role = "admin" | "opsteam" | "b2bclient";

export default function UsersPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<Role>("opsteam");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const filePreview = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Invalid email";
    if (!phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    else if (!/^\d{10}$/.test(phoneNumber.replace(/\D/g, "").slice(-10)))
      e.phoneNumber = "Enter 10-digit phone number";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Min 6 characters";
    return e;
  }, [name, email, phoneNumber, password]);

  const isValid = Object.keys(errors).length === 0;

  async function submit() {
    setOut("");
    setStatus("idle");

    if (!isValid) {
      setStatus("error");
      setOut("Fix validation errors and try again.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("email", email.trim());
      fd.append("phoneNumber", phoneNumber.trim());
      fd.append("role", role);
      fd.append("password", password);
      if (file) fd.append("profilePicture", file);

      const { data } = await api.post("/user/auth/register", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("success");
      setOut(typeof data === "string" ? data : JSON.stringify(data, null, 2));

      // reset form
      setName("");
      setEmail("");
      setPhoneNumber("");
      setRole("opsteam");
      setPassword("");
      setFile(null);
    } catch (e: any) {
      setStatus("error");
      setOut(apiErrorMessage(e, "Create user failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Users</h1>
            <p className="mt-1 text-sm text-slate-600">Admin-only: create ops / b2b users.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setName("");
              setEmail("");
              setPhoneNumber("");
              setRole("opsteam");
              setPassword("");
              setFile(null);
              setOut("");
              setStatus("idle");
            }}
            className="h-10 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          {/* Form */}
          <div className="md:col-span-3 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              <Field
                label="Name"
                placeholder="Full name"
                value={name}
                onChange={setName}
                error={errors.name}
              />
              <Field
                label="Email"
                placeholder="name@company.com"
                value={email}
                onChange={setEmail}
                error={errors.email}
              />
              <Field
                label="Phone number"
                placeholder="10-digit"
                value={phoneNumber}
                onChange={setPhoneNumber}
                error={errors.phoneNumber}
                inputMode="numeric"
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Role</label>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-300"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="admin">Admin</option>
                  <option value="opsteam">Ops Team</option>
                  <option value="b2bclient">B2B Client</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <input
                  className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none ${
                    errors.password ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-slate-300"
                  }`}
                  type="password"
                  placeholder="Min 6 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password ? <p className="text-xs text-rose-600">{errors.password}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Profile picture (optional)</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer">
                    Choose file
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {file ? (
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {filePreview ? (
                          <img src={filePreview} alt="preview" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate max-w-[220px]">{file.name}</p>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">PNG/JPG recommended</p>
                  )}
                </div>
              </div>

              <button
                disabled={busy || !isValid}
                onClick={submit}
                className="h-11 w-full rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900"
              >
                {busy ? "Creating..." : "Create User"}
              </button>

              {!isValid ? (
                <p className="text-xs text-slate-500">
                  Fill all required fields to enable submit.
                </p>
              ) : null}
            </div>
          </div>

          {/* Output / Status */}
          <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-900">Result</p>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                  status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : status === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {status === "success" ? "Success" : status === "error" ? "Error" : "Idle"}
              </span>
            </div>

            <div className="mt-3">
              {out ? (
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 overflow-auto max-h-[360px]">
                  {out}
                </pre>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-600">Response will appear here after you create a user.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Small note */}
        <p className="mt-4 text-xs text-slate-500">
          Endpoint: <span className="font-mono">POST /user/auth/register</span> (multipart/form-data)
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- Small Field Component ----------------------------- */
function Field({
  label,
  placeholder,
  value,
  onChange,
  error,
  inputMode,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        className={`h-11 w-full rounded-2xl border px-4 text-sm outline-none ${
          error ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-slate-300"
        }`}
        placeholder={placeholder}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
