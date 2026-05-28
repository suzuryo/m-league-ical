import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Save content to a file
 * @param filename - Relative or absolute filename
 * @param content - Content to write to the file
 */
export function saveToFile(filename: string, content: string): void {
  const filepath = join(process.cwd(), filename)
  mkdirSync(dirname(filepath), { recursive: true })
  writeFileSync(filepath, content, 'utf-8')
  console.log(`Saved to ${filename}`)
}
