"use client";

import { useId, type ReactNode } from "react";
import { formatYears, MAX_TERM_YEARS } from "@/lib/nda/build";
import type { NdaValues, PartyDetails } from "@/lib/nda/types";
import { inputBase, inputClass } from "@/components/ui/styles";

function TextField({
  label,
  hint,
  value,
  onChange,
  rows,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders a textarea with this many rows. */
  rows?: number;
  type?: "text" | "date";
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const common = {
    id,
    className: inputClass,
    value,
    "aria-describedby": hint ? hintId : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {rows ? <textarea rows={rows} {...common} /> : <input type={type} {...common} />}
      {hint && (
        <p id={hintId} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-brand-navy">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * A choice between a fixed number of years and an open-ended alternative.
 * The years value is kept while the alternative is selected, so switching back restores it.
 */
function TermChoice({
  legend,
  years,
  fixed,
  alternativeLabel,
  onYearsChange,
  onFixedChange,
}: {
  legend: string;
  /** NaN when the field is empty. */
  years: number;
  fixed: boolean;
  alternativeLabel: string;
  onYearsChange: (years: number) => void;
  onFixedChange: (fixed: boolean) => void;
}) {
  const name = useId();
  const errorId = `${name}-error`;
  const invalid = fixed && formatYears(years) === undefined;
  return (
    <fieldset className="space-y-2 text-sm text-stone-800">
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          aria-label="A fixed number of years"
          checked={fixed}
          onChange={() => onFixedChange(true)}
        />
        <input
          type="number"
          min={1}
          max={MAX_TERM_YEARS}
          step={1}
          aria-label={`${legend} in years`}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={`w-20 shrink-0 ${inputBase} aria-invalid:border-red-500`}
          value={Number.isNaN(years) ? "" : years}
          disabled={!fixed}
          onChange={(e) => onYearsChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        <span aria-hidden>year(s) from Effective Date</span>
      </div>
      {invalid && (
        <p id={errorId} className="text-xs text-red-700">
          Enter a whole number of years from 1 to {MAX_TERM_YEARS}.
        </p>
      )}
      <label className="flex items-center gap-2">
        <input type="radio" name={name} checked={!fixed} onChange={() => onFixedChange(false)} />
        {alternativeLabel}
      </label>
    </fieldset>
  );
}

const PARTY_FIELDS: { key: keyof PartyDetails; label: string; hint?: string }[] = [
  { key: "company", label: "Company" },
  { key: "name", label: "Signer name" },
  { key: "title", label: "Title" },
  { key: "noticeAddress", label: "Notice address", hint: "Email or postal address" },
];

export function NdaForm({ values, onChange }: { values: NdaValues; onChange: (values: NdaValues) => void }) {
  const set = <K extends keyof NdaValues>(key: K) => (value: NdaValues[K]) => onChange({ ...values, [key]: value });

  const setParty = (index: 0 | 1, key: keyof PartyDetails) => (value: string) => {
    const parties: NdaValues["parties"] = [...values.parties];
    parties[index] = { ...parties[index], [key]: value };
    onChange({ ...values, parties });
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Fieldset legend="Agreement">
        <TextField
          label="Purpose"
          hint="How Confidential Information may be used"
          rows={3}
          value={values.purpose}
          onChange={set("purpose")}
        />
        <TextField label="Effective Date" type="date" value={values.effectiveDate} onChange={set("effectiveDate")} />
        <TermChoice
          legend="MNDA Term"
          years={values.mndaTerm.years}
          fixed={values.mndaTerm.kind === "expires"}
          alternativeLabel="Continues until terminated"
          onYearsChange={(years) => set("mndaTerm")({ ...values.mndaTerm, years })}
          onFixedChange={(fixed) =>
            set("mndaTerm")({ ...values.mndaTerm, kind: fixed ? "expires" : "untilTerminated" })
          }
        />
        <TermChoice
          legend="Term of Confidentiality"
          years={values.confidentialityTerm.years}
          fixed={values.confidentialityTerm.kind === "years"}
          alternativeLabel="In perpetuity"
          onYearsChange={(years) => set("confidentialityTerm")({ ...values.confidentialityTerm, years })}
          onFixedChange={(fixed) =>
            set("confidentialityTerm")({ ...values.confidentialityTerm, kind: fixed ? "years" : "perpetual" })
          }
        />
      </Fieldset>

      <Fieldset legend="Governing Law & Jurisdiction">
        <TextField
          label="Governing Law"
          hint="State whose laws govern the MNDA, e.g. Delaware"
          value={values.governingLaw}
          onChange={set("governingLaw")}
        />
        <TextField
          label="Jurisdiction"
          hint="City or county and state, e.g. courts located in New Castle, DE"
          value={values.jurisdiction}
          onChange={set("jurisdiction")}
        />
        <TextField
          label="MNDA Modifications"
          hint="Optional. Any changes to the Standard Terms."
          rows={2}
          value={values.modifications}
          onChange={set("modifications")}
        />
      </Fieldset>

      {([0, 1] as const).map((index) => (
        <Fieldset key={index} legend={`Party ${index + 1}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {PARTY_FIELDS.map(({ key, label, hint }) => (
              <TextField
                key={key}
                label={label}
                hint={hint}
                value={values.parties[index][key]}
                onChange={setParty(index, key)}
              />
            ))}
          </div>
        </Fieldset>
      ))}
    </form>
  );
}
