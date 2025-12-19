import { mkdirSync } from 'fs'
import { join } from 'path'

mkdirSync('res', { recursive: true })

export let log_sheet_file = 'res/log-sheet.csv'
export let summary_directory = 'res/summary'
export let text_file = join(process.env.HOME!, 'timesheet.txt')
export let draft_file = 'res/draft.csv'
export let default_year = new Date().getFullYear()
