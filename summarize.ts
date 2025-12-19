import { mkdirSync } from 'fs'
import { join } from 'path'
import { readCSV, writeCSV } from './fs'
import { default_year, log_sheet_file, summary_directory } from './config'
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
 * Example Output Folder Structure
 * ```
 * res/summary/
 * ├── tasks.all.csv
 * ├── tasks.2024.csv
 * ├── tasks.2025.csv
 * ├── tags.all.csv
 * ├── tags.2024.csv
 * └── tags.2025.csv
 * ```
 *
 * Example Output Task Content (to res/summary/tasks.all.csv):
 * ```
 * Task,Total Hour
 * media-search,1.5
 * format-html-cli,0.2
 * ```
 *
 * Example Output Tag Content (to res/summary/tags.all.csv):
 * ```
 * Tag,Total Hour
 * wip,1.0
 * feat,0.7
 * ```
 */

function summarize() {
  // year -> tag -> hours
  let tags_by_year: Record<string, number>[] = []

  // year -> task -> hours
  let task_by_year: Record<string, number>[] = []

  let rows = readCSV(log_sheet_file)
  for (let row of rows) {
    let task = row.Task || ''
    let remark = row.Remark || ''
    let duration = +row['Duration (hour)'] || 0

    let year = +row.From?.split('-')[0] || default_year

    inc(task_by_year, year, task, duration)

    let tags = extract_tags({ task, remark })
    let average_duration = duration / tags.length
    for (let tag of tags) {
      inc(tags_by_year, year, tag, average_duration)
    }
  }

  mkdirSync(summary_directory, { recursive: true })

  save_counts({
    file_prefix: 'tasks',
    label: 'Task',
    counts_by_year: task_by_year,
  })
  save_counts({
    file_prefix: 'tags',
    label: 'Tag',
    counts_by_year: tags_by_year,
  })
}

function extract_tags(row: { task: string; remark: string }): string[] {
  let { task, remark } = row

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

  return tags
}

function inc(
  // year -> key -> amount
  counts_by_year: Record<string, number>[],
  year: number,
  key: string,
  amount: number,
) {
  let counts = counts_by_year[year]
  if (!counts) {
    counts = counts_by_year[year] = {}
  }
  let count = counts[key] || 0
  counts[key] = count + amount
}

function save_counts(args: {
  file_prefix: string
  label: string
  counts_by_year: Record<string, number>[]
}) {
  let { file_prefix, label, counts_by_year } = args

  let total_counts: Record<string, number> = {}
  for (let [year, counts] of Object.entries(counts_by_year)) {
    for (let [key, amount] of Object.entries(counts)) {
      let count = total_counts[key] || 0
      total_counts[key] = count + amount
    }
    save_summary(
      join(summary_directory, `${file_prefix}.${year}.csv`),
      label,
      counts,
    )
  }
  save_summary(
    join(summary_directory, `${file_prefix}.all.csv`),
    label,
    total_counts,
  )
}

function save_summary(
  file: string,
  label: string,
  counts: Record<string, number>,
) {
  let summary = Object.entries(counts).map(([key, count]) => ({
    [label]: key,
    'Total Hour': count,
  }))
  writeCSV(file, summary)
}

summarize()
