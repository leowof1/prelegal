/** Reminds the user that a generated agreement is a draft for legal review. */
export function DraftDisclaimer() {
  return (
    <div role="note" aria-label="Draft disclaimer" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-5 shrink-0 text-amber-600">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <p>
        <strong className="font-semibold">Draft only, subject to legal review.</strong> This document was generated with
        AI from Common Paper templates. Have a qualified lawyer review it before you sign or rely on it.
      </p>
    </div>
  );
}
