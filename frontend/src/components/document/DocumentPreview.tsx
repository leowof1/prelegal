import { Fragment } from "react";
import type { Block, Inline } from "@/lib/document/types";

function InlineText({ content }: { content: Inline[] }) {
  return content.map((run, i) => {
    if (run.href) {
      return (
        <a key={i} href={run.href} target="_blank" rel="noopener noreferrer" className="underline">
          {run.text}
        </a>
      );
    }
    return run.bold ? <strong key={i}>{run.text}</strong> : <Fragment key={i}>{run.text}</Fragment>;
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "title":
      return <h2 className="text-center text-2xl font-bold text-brand-navy">{block.text}</h2>;
    case "heading":
      return <h3 className="mt-2 text-sm font-bold uppercase tracking-wide text-brand-navy">{block.text}</h3>;
    case "paragraph":
      return (
        <p>
          <InlineText content={block.content} />
        </p>
      );
    case "field":
      return (
        <section>
          <h4 className="font-bold">{block.heading}</h4>
          {block.hint && <p className="text-xs italic text-stone-500">{block.hint}</p>}
          {block.lines.map((line, i) => (
            <p key={i}>
              <span className={line.placeholder ? "rounded bg-amber-100 px-1 text-amber-800" : "whitespace-pre-line"}>
                {line.value}
              </span>
            </p>
          ))}
        </section>
      );
    case "signatures":
      return (
        <div className="space-y-4">
          <p>{block.intro}</p>
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-1/4 border border-stone-300 p-2">
                  <span className="sr-only">Field</span>
                </th>
                {block.headers.map((header) => (
                  <th key={header} scope="col" className="border border-stone-300 p-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border border-stone-300 p-2 text-left font-semibold">
                    {row.label}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={i} className="h-10 whitespace-pre-line break-words border border-stone-300 p-2">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "clause":
      return (
        <p style={{ marginLeft: `${block.level * 1.5}rem` }}>
          {block.label} <InlineText content={block.content} />
        </p>
      );
    case "attribution":
      return (
        <p className="text-xs text-stone-500">
          <InlineText content={block.content} />
        </p>
      );
    case "pageBreak":
      return <hr className="my-6 border-dashed border-brand-gray" />;
  }
}

export function DocumentPreview({ blocks }: { blocks: Block[] }) {
  return (
    <article className="space-y-4 font-serif text-[15px] leading-relaxed text-stone-900">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </article>
  );
}
