import React, { useState } from "react";
import { TOKENS } from "../styles/tokens.js";

export default function Login() {
  const [email, setEmail] = useState("admin@grabsum.edu");
  const [password, setPassword] = useState("password");

  return (
    <div className={`min-h-screen ${TOKENS.bg} ${TOKENS.text} font-[Nunito] grid place-items-center p-6`}>
      <div className={`w-full max-w-md rounded-2xl border ${TOKENS.border} ${TOKENS.panel} p-6 shadow-sm`}>
        <div className="text-xs font-semibold text-black/55">Grabsum SHS Portal</div>
        <div className="text-2xl font-extrabold">Login (UI only)</div>
        <div className="mt-1 text-sm text-black/55">Auth will be connected to Supabase later.</div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-black/55">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-black/55">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:bg-white" />
          </label>

          <button
            onClick={() => alert("Not implemented yet. Connect Supabase Auth later.")}
            className={`w-full rounded-2xl px-4 py-2 text-sm font-extrabold ${TOKENS.goldBg} text-black hover:opacity-95`}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   src/lib/supabase.js (placeholder)
===================================================== */

// Placeholder for later.
// When ready:
// import { createClient } from '@supabase/supabase-js'
// export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const supabase = null;

/* =====================================================
   src/lib/queryclient.js (placeholder)
===================================================== */

// Placeholder for later (if you add TanStack Query).
export const queryClient = null;

/* =====================================================
   src/index.css
===================================================== */

/*
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { font-family: Nunito, ui-sans-serif, system-ui; }
*/

/* =====================================================
   Install notes
===================================================== */

/*
1) npm i react-router-dom framer-motion lucide-react
2) Tailwind setup with Vite
3) Put Nunito import in src/index.css (above)

When you’re ready for Supabase:
- We’ll add: npm i @supabase/supabase-js
- Then implement auth guards + database fetching for Enrollment.
*/
