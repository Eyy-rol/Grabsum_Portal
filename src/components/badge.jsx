import React from "react";

export default function Badge({ children }) {
  return (
    <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">
      {children}
    </span>
  );
}