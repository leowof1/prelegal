/** A centered spinner with a message, for content that is still loading. */
export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-stone-600">
      <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-blue" />
      {label}
    </p>
  );
}
