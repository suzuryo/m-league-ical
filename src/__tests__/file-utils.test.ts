import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { saveToFile } from '../utils/file-utils'

describe('file-utils', () => {
  const testDir = join(process.cwd(), 'test-output')
  const testFile = 'test-output/test.txt'

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('saveToFile', () => {
    it('ファイルを正しく保存する', () => {
      const content = 'Test content'

      saveToFile(testFile, content)

      const filePath = join(process.cwd(), testFile)
      expect(existsSync(filePath)).toBe(true)

      const savedContent = readFileSync(filePath, 'utf-8')
      expect(savedContent).toBe(content)
    })

    it('既存のファイルを上書きする', () => {
      const content1 = 'First content'
      const content2 = 'Second content'

      saveToFile(testFile, content1)
      saveToFile(testFile, content2)

      const filePath = join(process.cwd(), testFile)
      const savedContent = readFileSync(filePath, 'utf-8')
      expect(savedContent).toBe(content2)
    })

    it('UTF-8エンコーディングで保存する', () => {
      const content = 'テスト内容: 日本語テキスト 🎌'

      saveToFile(testFile, content)

      const filePath = join(process.cwd(), testFile)
      const savedContent = readFileSync(filePath, 'utf-8')
      expect(savedContent).toBe(content)
    })

    it('保存時にログを出力する', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const content = 'Test content'

      saveToFile(testFile, content)

      expect(consoleSpy).toHaveBeenCalledWith(`Saved to ${testFile}`)

      consoleSpy.mockRestore()
    })
  })
})
