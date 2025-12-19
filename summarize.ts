import { readCSV, writeCSV } from './fs'
import { summary_file, log_sheet_file } from './config'
import { mapTag } from './category'

/**
 * Example Input Content (from res/log-sheet.csv):
 * ```
 * Task,Duration (hour),Remark
 * media-search,1.0,wip: add types and wrapper functions for bing and duckduckgo image search
 * media-search,0.5,feat: add a unified function to search image from multiple sources
 * format-html-cli,0.2,feat: restore the casing for DOCTYPE formatted by prettier
 * ```
 *
 * Example Output Content (to res/summary.csv):
 * ```
 * Task,Total Hour
 * media-search,1.5
 * format-html-cli,0.2
 * ```
 */

let counts: Record<string, number> = {}

let rows = readCSV(log_sheet_file)
for (let row of rows) {
  let task = row.Task || ''
  let remark = row.Remark || ''
  let duration = +row['Duration (hour)'] || 0

  let tags = remark
    .split('\n')
    .map(line => line.match(/^(\w+): /)?.[1]?.trim()!)
    .filter(tag => tag)
    .map(mapTag)

  if (tags.length == 0 && remark.toLowerCase().includes('setup ')) {
    tags.push('devop')
  }

  if (tags.length == 0 && remark.toLowerCase().includes('add ')) {
    tags.push('dev')
  }

  if (tags.length == 0) {
    tags.push(task)
  }

  for (let tag of tags) {
    let count = counts[tag] || 0
    counts[tag] = count + duration / tags.length
  }
}

let summary = Object.entries(counts).map(([tag, count]) => ({
  'Task': tag,
  'Total Hour': count,
}))
writeCSV(summary_file, summary)
