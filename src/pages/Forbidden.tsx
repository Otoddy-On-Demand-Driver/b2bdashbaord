import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md rounded-3xl bg-white border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You don’t have permission to access this section.
        </p>

        <Link
          to="/"
          className="inline-flex mt-6 h-11 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
