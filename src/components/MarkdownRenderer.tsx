import React from 'react'

interface Props {
  content: string
}

/** Sanitize URLs — only allow safe schemes to prevent XSS via javascript: or data: URIs */
function safeHref(url: string): string {
  try {
    const u = new URL(url, 'https://safe.invalid')
    if (/^https?:$/.test(u.protocol)) return url
  } catch {
    // Relative path — allow
    if (!url.includes(':')) return url
  }
  return '#'
}

/** Minimal markdown renderer — handles the subset we need for session articles. */
export function MarkdownRenderer({ content }: Props) {
  const lines = content.split('\n')
  const elements: React.ReactElement[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      // Bug 5 fix: only skip closing ``` if we actually found it
      if (i < lines.length) {
        i++ // skip closing ```
      }
      elements.push(
        <pre key={key++} className="md-code-block" data-lang={lang || undefined}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Setext headings — look-ahead: next line is === (h1) or --- (h2)
    // Must check before ATX headings and HR, and line must be non-empty text
    // Bug 3 fix: only trigger setext h2 if previous line is non-empty text
    // and not itself a list item or heading
    if (
      line.trim() !== '' &&
      !line.startsWith('#') &&
      !line.match(/^[-*]\s/) &&
      !line.match(/^\d+\.\s/) &&
      i + 1 < lines.length
    ) {
      const nextLine = lines[i + 1]
      if (/^={3,}\s*$/.test(nextLine)) {
        elements.push(
          React.createElement('h1', { key: key++, className: 'md-h1' }, renderInline(line.trim())),
        )
        i += 2
        continue
      }
      if (/^-{3,}\s*$/.test(nextLine)) {
        elements.push(
          React.createElement('h2', { key: key++, className: 'md-h2' }, renderInline(line.trim())),
        )
        i += 2
        continue
      }
    }

    // ATX Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4
      const text = headingMatch[2]
      const className = `md-h${level}`
      elements.push(React.createElement(`h${level}`, { key: key++, className }, renderInline(text)))
      i++
      continue
    }

    // Blockquote — consume consecutive `> ` and `>` lines (blank `>` = paragraph break)
    if (line.startsWith('> ') || line === '>') {
      const paragraphs: string[][] = [[]]
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        const stripped = lines[i] === '>' ? '' : lines[i].slice(2)
        if (stripped === '') {
          // blank line inside blockquote = paragraph separator
          if (paragraphs[paragraphs.length - 1].length > 0) {
            paragraphs.push([])
          }
        } else {
          paragraphs[paragraphs.length - 1].push(stripped)
        }
        i++
      }
      // Remove trailing empty paragraph
      if (paragraphs[paragraphs.length - 1].length === 0) {
        paragraphs.pop()
      }
      elements.push(
        <blockquote key={key++} className="md-blockquote">
          {paragraphs.map((lines, j) => (
            <p key={j}>{renderInline(lines.join(' '))}</p>
          ))}
        </blockquote>,
      )
      continue
    }

    // Bug 4 fix: Table — require at least 2 pipes OR line starts/ends with pipe
    // to avoid false positives on sentences like "choose A | B"
    const hasSufficientPipes =
      (line.match(/\|/g) ?? []).length >= 2 ||
      line.trimStart().startsWith('|') ||
      line.trimEnd().endsWith('|')
    if (hasSufficientPipes && i + 1 < lines.length && /^\|?[\s|:-]+\|/.test(lines[i + 1])) {
      const headerCells = parseTableRow(line)
      i++ // skip separator row
      i++
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        bodyRows.push(parseTableRow(lines[i]))
        i++
      }
      elements.push(
        <table key={key++} className="md-table">
          <thead>
            <tr>
              {headerCells.map((cell, j) => (
                <th key={j} className="md-th">{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="md-td">{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    // Unordered list (with nested support)
    // Bug 2 fix: list detectors run BEFORE indented code block check
    if (line.match(/^[-*]\s/)) {
      const [listEl, newI] = parseList(lines, i, key++, false)
      elements.push(listEl)
      i = newI
      continue
    }

    // Ordered list (with nested support)
    if (line.match(/^\d+\.\s/)) {
      const [listEl, newI] = parseList(lines, i, key++, true)
      elements.push(listEl)
      i = newI
      continue
    }

    // Indented code block (4 spaces or tab)
    // Bug 2 fix: moved AFTER list detectors so `    - item` is not consumed as code
    if (line.startsWith('    ') || line.startsWith('\t')) {
      const codeLines: string[] = []
      while (i < lines.length && (lines[i].startsWith('    ') || lines[i].startsWith('\t') || lines[i].trim() === '')) {
        // Blank lines inside the block are kept; trailing blank lines are trimmed later
        codeLines.push(lines[i].startsWith('\t') ? lines[i].slice(1) : lines[i].slice(4))
        i++
      }
      // Trim trailing blank lines
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
        codeLines.pop()
      }
      elements.push(
        <pre key={key++} className="md-code-block">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Horizontal rule
    // Bug 3 fix: HR detector catches bare --- when line is empty or start-of-doc
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={key++} className="md-hr" />)
      i++
      continue
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      elements.push(
        <figure key={key++} className="md-figure">
          <img src={safeHref(imgMatch[2])} alt={imgMatch[1]} className="md-img" />
          {imgMatch[1] && <figcaption className="md-figcaption">{imgMatch[1]}</figcaption>}
        </figure>,
      )
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Bug 1 fix: Multi-line paragraph — accumulate consecutive non-empty, non-special lines
    // and emit ONE <p> with them joined
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      lines[i] !== '>' &&
      !lines[i].match(/^[-*]\s/) &&
      !lines[i].match(/^\d+\.\s/) &&
      !lines[i].match(/^---+$/) &&
      !lines[i].match(/^\*\*\*+$/) &&
      !lines[i].match(/^!\[([^\]]*)\]\(([^)]+)\)$/) &&
      // Don't absorb setext heading underlines
      !lines[i].match(/^={3,}\s*$/) &&
      !lines[i].match(/^-{3,}\s*$/)
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={key++} className="md-p">{renderInline(paraLines.join('\n'))}</p>,
      )
    }
  }

  return <div className="md-body">{elements}</div>
}

/** Parse a table row: `| a | b | c |` or `a | b | c` → ['a','b','c'] */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const stripped = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const cells = stripped.endsWith('|') ? stripped.slice(0, -1) : stripped
  return cells.split('|').map(c => c.trim())
}

/**
 * Parse a list block (ul or ol) starting at lines[start].
 * Handles nested lists via indentation (2+ spaces or tab prefix).
 * Returns [JSX element, new line index].
 */
function parseList(
  lines: string[],
  start: number,
  keyBase: number,
  ordered: boolean,
): [React.ReactElement, number] {
  const isTopLevelItem = ordered
    ? (l: string) => /^\d+\.\s/.test(l)
    : (l: string) => /^[-*]\s/.test(l)

  const isIndented = (l: string) => l.startsWith('  ') || l.startsWith('\t')
  const isNestedUl = (l: string) => isIndented(l) && /^[ \t]*[-*]\s/.test(l)
  const isNestedOl = (l: string) => isIndented(l) && /^[ \t]*\d+\.\s/.test(l)

  const items: React.ReactElement[] = []
  let i = start
  let itemKey = 0

  while (i < lines.length && isTopLevelItem(lines[i])) {
    const rawText = ordered
      ? lines[i].replace(/^\d+\.\s/, '')
      : lines[i].replace(/^[-*]\s/, '')

    // Check if next lines are indented (nested list)
    i++
    const nestedLines: string[] = []
    while (i < lines.length && (isNestedUl(lines[i]) || isNestedOl(lines[i]))) {
      nestedLines.push(lines[i])
      i++
    }

    if (nestedLines.length > 0) {
      // Dedent nested lines: strip leading whitespace until we reach the list marker
      // Handles both 2-space and 4-space indentation
      const dedented = nestedLines.map(l => {
        if (l.startsWith('\t')) return l.slice(1)
        // Strip leading spaces up to the list marker
        const stripped = l.replace(/^[ \t]+/, '')
        return stripped
      })
      const nestedIsOrdered = /^\d+\.\s/.test(dedented[0])
      const [nestedEl] = parseList(dedented, 0, itemKey * 100, nestedIsOrdered)
      items.push(
        <li key={itemKey++}>
          {renderInline(rawText)}
          {nestedEl}
        </li>,
      )
    } else {
      items.push(<li key={itemKey++}>{renderInline(rawText)}</li>)
    }
  }

  const Tag = ordered ? 'ol' : 'ul'
  const className = ordered ? 'md-ol' : 'md-ul'
  return [
    React.createElement(Tag, { key: keyBase, className }, items),
    i,
  ]
}

/**
 * Render inline markdown: bold, italic, strikethrough, inline code, links.
 *
 * NOTE: inline images (![alt](url)) are intentionally NOT supported here —
 * block-level images (in MarkdownRenderer body loop) use safeHref().
 * If you add inline image support, you MUST call safeHref() on the URL.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Pattern order matters: ** before *, ~~ before text
  const regex =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~~(.+?)~~)|(`([^`]+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      // Bold
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      // Italic
      parts.push(<em key={key++}>{match[4]}</em>)
    } else if (match[5]) {
      // Strikethrough
      parts.push(<del key={key++}>{match[6]}</del>)
    } else if (match[7]) {
      // Inline code
      parts.push(<code key={key++} className="md-inline-code">{match[8]}</code>)
    } else if (match[9]) {
      // Link
      parts.push(
        <a key={key++} href={safeHref(match[11])} className="md-link" target="_blank" rel="noopener noreferrer">
          {match[10]}
        </a>,
      )
    }
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 ? parts[0] : parts
}
