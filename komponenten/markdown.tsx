import { markdownZerlegen, type Baustein, type Inline } from '@/lib/markdown'

/**
 * Zeigt die Antwort des Coach.
 *
 * Baut React-Elemente aus den Bausteinen. `dangerouslySetInnerHTML` kommt
 * nicht vor — jede Zeichenkette landet als Textknoten, und React maskiert sie.
 * Steht in einer Antwort also `<img onerror=…>`, erscheint das als Text.
 */

function InlineTeil({ teil }: { teil: Inline }) {
  switch (teil.art) {
    case 'fett':
      return <strong className="font-semibold text-text-stark">{teil.text}</strong>
    case 'kursiv':
      return <em className="italic">{teil.text}</em>
    case 'code':
      return (
        <code className="rounded-[2px] bg-flaeche-2 px-1 py-0.5 font-mono text-[0.9em] text-text-stark">
          {teil.text}
        </code>
      )
    default:
      return <>{teil.text}</>
  }
}

function Teile({ teile }: { teile: Inline[] }) {
  return (
    <>
      {teile.map((t, i) => (
        <InlineTeil key={i} teil={t} />
      ))}
    </>
  )
}

function BausteinZeigen({ baustein }: { baustein: Baustein }) {
  switch (baustein.art) {
    case 'ueberschrift':
      return baustein.ebene === 2 ? (
        <h2 className="mt-4 mb-1.5 text-[14px] font-semibold text-text-stark first:mt-0">
          <Teile teile={baustein.teile} />
        </h2>
      ) : (
        <h3 className="marke mt-3.5 mb-1.5 text-[10px] text-text-schwach first:mt-0">
          <Teile teile={baustein.teile} />
        </h3>
      )

    case 'liste':
      return baustein.nummeriert ? (
        <ol className="my-2 ml-5 list-decimal space-y-1">
          {baustein.punkte.map((p, i) => (
            <li key={i} className="pl-1">
              <Teile teile={p} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-2 ml-5 list-disc space-y-1">
          {baustein.punkte.map((p, i) => (
            <li key={i} className="pl-1">
              <Teile teile={p} />
            </li>
          ))}
        </ul>
      )

    case 'codeblock':
      return (
        <pre className="my-2.5 overflow-x-auto border border-kontur bg-flaeche-2 p-3 font-mono text-[11.5px] leading-relaxed text-text">
          {baustein.text}
        </pre>
      )

    default:
      return (
        <p className="my-2 leading-relaxed first:mt-0 last:mb-0">
          <Teile teile={baustein.teile} />
        </p>
      )
  }
}

export function Markdown({ text }: { text: string }) {
  const bausteine = markdownZerlegen(text)
  return (
    <div className="text-[13.5px] text-text">
      {bausteine.map((b, i) => (
        <BausteinZeigen key={i} baustein={b} />
      ))}
    </div>
  )
}
