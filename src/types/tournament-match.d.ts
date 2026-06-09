export interface TournamentMatch {
  date: string
  startTime: string
  endTime: string
  stage: string
  table: string
  players: string[]
  url?: string
  // 補助データ専用フラグ。true のとき、同キー (date+stage+table) の公式試合を
  // 上書きして補助データを優先する。公式試合には付与しない。
  override?: boolean
}
