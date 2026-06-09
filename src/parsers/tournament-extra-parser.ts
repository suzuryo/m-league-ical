import { existsSync, readFileSync } from 'node:fs'

import { parse } from 'yaml'

import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'
import { addMinutesToTime } from '../utils/calendar-utils'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{6}$/

type RawEntry = {
  date?: unknown
  stage?: unknown
  table?: unknown
  startTime?: unknown
  players?: unknown
  url?: unknown
  source?: unknown
  override?: unknown
}

type RawDocument = {
  matches?: unknown
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function validateEntry(entry: RawEntry): TournamentMatch | null {
  if (!isString(entry.date) || !DATE_PATTERN.test(entry.date)) {
    return null
  }

  if (!Array.isArray(entry.players) || entry.players.length === 0) {
    return null
  }
  const players = entry.players.filter(isString)
  if (players.length === 0) {
    return null
  }

  let startTime: string = M_TOURNAMENT_CONFIG.calendar.defaultStartTime
  if (entry.startTime !== undefined) {
    if (!isString(entry.startTime) || !TIME_PATTERN.test(entry.startTime)) {
      return null
    }
    startTime = entry.startTime
  }

  // override は任意。指定された場合は boolean のみ許容し、それ以外は不正として弾く。
  if (entry.override !== undefined && typeof entry.override !== 'boolean') {
    return null
  }

  const stage = isString(entry.stage) ? entry.stage : ''
  const table = isString(entry.table) ? entry.table : ''
  const url = isString(entry.url) ? entry.url : undefined

  return {
    date: entry.date,
    startTime,
    endTime: addMinutesToTime(
      startTime,
      M_TOURNAMENT_CONFIG.calendar.matchDurationMinutes,
    ),
    stage,
    table,
    players,
    url,
    // override は true のときだけ付与する (公式優先の既定挙動を保つため)。
    ...(entry.override === true ? { override: true } : {}),
  }
}

export function parseExtraData(filePath: string): TournamentMatch[] {
  if (!existsSync(filePath)) {
    return []
  }

  const content = readFileSync(filePath, 'utf-8')

  let doc: RawDocument
  try {
    doc = parse(content) as RawDocument
  } catch (error) {
    console.log('Failed to parse extra data YAML:', error)
    return []
  }

  if (!doc || !Array.isArray(doc.matches)) {
    return []
  }

  const results: TournamentMatch[] = []
  for (const rawEntry of doc.matches) {
    const validated = validateEntry(rawEntry as RawEntry)
    if (validated === null) {
      console.log('Skipped invalid extra data entry:', rawEntry)
      continue
    }
    results.push(validated)
  }

  return results
}
