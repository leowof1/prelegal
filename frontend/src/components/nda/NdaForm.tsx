"use client";

import { useId, type ReactNode } from "react";
import type { NdaValues, PartyDetails } from "@/lib/nda/types";

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-stone-100 disabled:text-stone-400";

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
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-stone-600">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * A choice between "N years" and an open-ended alternative.
 * `years` is null when the alternative is selected; 0 means the number field is empty.
 */
function TermChoice({
  legend,
  years,
  alternativeLabel,
  onChange,
}: {
  legend: string;
  years: number | null;
  alternativeLabel: string;
  onChange: (years: number | null) => void;
}) {
  const name = useId();
  const yearsSelected = years !== null;
  return (
    <fieldset className="space-y-2 text-sm text-stone-800">
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex items-center gap-2">
        <input
          type="radio"
          name={name}
          aria-label="A fixed number of years"
          checked={yearsSelected}
          onChange={() => onChange(1)}
        />
        <input
          type="number"
          min={1}
          step={1}
          aria-label={`${legend} in years`}
          className={`${inputClass} w-20`}
          value={yearsSelected ? years || "" : 1}
          disabled={!yearsSelected}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span aria-hidden>year(s) from Effective Date</span>
      </div>
      <label className="flex items-center gap-2">
        <input type="radio" name={name} checked={!yearsSelected} onChange={() => onChange(null)} />
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
          years={values.mndaTerm.kind === "expires" ? values.mndaTerm.years : null}
          alternativeLabel="Continues until terminated"
          onChange={(years) =>
            set("mndaTerm")(years === null ? { kind: "untilTerminated" } : { kind: "expires", years })
          }
        />
        <TermChoice
          legend="Term of Confidentiality"
          years={values.confidentialityTerm.kind === "years" ? values.confidentialityTerm.years : null}
          alternativeLabel="In perpetuity"
          onChange={(years) =>
            set("confidentialityTerm")(years === null ? { kind: "perpetual" } : { kind: "years", years })
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
