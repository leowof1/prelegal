// Width is kept out of the shared classes: conflicting Tailwind width utilities
// (e.g. w-full and w-20) resolve by stylesheet order, not class order.
export const inputBase =
  "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30 disabled:bg-stone-100 disabled:text-stone-400";
export const inputClass = `w-full ${inputBase}`;

export const submitButtonClass =
  "rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90";
