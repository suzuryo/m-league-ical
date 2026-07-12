const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g

const removeInlineCode = (line) => {
  let result = ''
  let index = 0

  while (index < line.length) {
    if (line[index] !== '`') {
      result += line[index]
      index += 1
      continue
    }

    const start = index
    while (index < line.length && line[index] === '`') {
      index += 1
    }

    const tickCount = index - start
    const delimiter = '`'.repeat(tickCount)
    const end = line.indexOf(delimiter, index)

    if (end === -1) {
      result += line.slice(start)
      break
    }

    result += ' '.repeat(end + tickCount - start)
    index = end + tickCount
  }

  return result
}

const findFenceMarker = (line) => {
  const match = /^( {0,3})(`{3,}|~{3,})/.exec(line)

  if (!match) {
    return null
  }

  return {
    char: match[2][0],
    length: match[2].length,
  }
}

module.exports = {
  names: ['no-wikilinks'],
  description: 'Wiki-style links are not GitHub Flavored Markdown',
  tags: ['links', 'gfm'],
  parser: 'none',
  function: (params, onError) => {
    let fence = null

    params.lines.forEach((line, lineIndex) => {
      const marker = findFenceMarker(line)

      if (marker) {
        if (
          fence &&
          marker.char === fence.char &&
          marker.length >= fence.length
        ) {
          fence = null
        } else if (!fence) {
          fence = marker
        }

        return
      }

      if (fence) {
        return
      }

      const searchableLine = removeInlineCode(line)
      const matches = searchableLine.matchAll(wikiLinkPattern)

      for (const match of matches) {
        onError({
          lineNumber: lineIndex + 1,
          detail:
            'Use a normal Markdown link for documents or a code span for skill/memory names.',
          context: match[0],
          range: [match.index + 1, match[0].length],
        })
      }
    })
  },
}
