import { extract_lines } from '@beenotung/tslib/string'
import { log_sheet_file } from './config'
import { readCSV } from './fs'

/**
 * Example Input Content:
 * ```
 * Task,Remark
 * website,implement email subscribe form
 * website,restore animation and youtube iframe in home page
 * image-ai-builder,exp: discuss rotation and zoom with elly
 * image-ai-builder,exp: implement way to drag to move/zoom bounding box
 * image-ai-builder,team: dev with elly
 * animal-ai,team: brief cat beard formula and image classify ai model training to sofia and lanna
 * animal-ai,team: discuss with benny and trevor on car beard direction calculation
 * ,team: demo sofia and lanna on box model training with colab
 * ,team: demo to lanna and sofia on colab box model training
 * ,exp: try hammer js with elly to zoom in and rotate the bounding box
 * ,team: brief idmm dataset export, import, extract tasks to lok
 *  - pose -> pose (crop bounding box)
 *  - pose -> classify (crop box)
 * ```
 *
 * Example Output Content:
 * ```
 * Task,Remark
 * website,implement email subscribe form
 * website,restore animation and youtube iframe in home page
 * image-ai-builder,exp: discuss rotation and zoom with elly
 * image-ai-builder,exp: implement way to drag to move/zoom bounding box
 * image-ai-builder,team: dev with elly
 * animal-ai,team: brief cat beard formula and image classify ai model training to sofia and lanna
 * animal-ai,team: discuss with benny and trevor on car beard direction calculation
 * animal-ai,team: demo sofia and lanna on box model training with colab
 * animal-ai,team: demo to lanna and sofia on colab box model training
 * image-ai-builder,exp: try hammer js with elly to zoom in and rotate the bounding box
 * image-ai-builder,team: brief idmm dataset export, import, extract tasks to lok
 *  - pose -> pose (crop bounding box)
 *  - pose -> classify (crop box)
 * ```
 *
 * With console output highlight the auto inferred Task.
 * ```
 * animal-ai <- team: demo sofia and lanna on box model training with colab
 *
 * animal-ai <- team: demo to lanna and sofia on colab box model training
 *
 * image-ai-builder <- exp: try hammer js with elly to zoom in and rotate the bounding box
 *
 * image-ai-builder <- team: brief idmm dataset export, import, extract tasks to lok
 *  - pose -> pose (crop bounding box)
 *  - pose -> classify (crop box)
 * ```
 *
 * Todo: interactively show all the possible tasks, ranked by similarity and let user select the best one.
 */

/**
 * Overall Plan
 * 1. collect remark examples with task name
 * 2. infer task using remark (each word -> task similarity)
 * 3. show all the possible tasks, ranked by similarity and let user select the best one.
 */

let rows = readCSV(log_sheet_file)

type Word = {
  word: string
  total_occurrence: number
  tasks: {
    // task name -> occurrence
    [task_name: string]: number
  }
}

// word -> Word Entry
let word_entries: Record<string, Word> = {}

let skip_words = extract_lines(`
is
an
the
and
or
not
of
on
of
to
`)

let symbols = '()-.,'

function extract_words(remark: string) {
  let words = remark.split(/\s+/)
  for (let symbol of symbols) {
    words = words.map(word => word.replaceAll(symbol, ''))
  }
  return words.filter(word => word.length > 0 && !skip_words.includes(word))
}

/**
 * 1. collect remark examples with task name
 */
for (let row of rows) {
  let task = row.Task || ''
  let remark = row.Remark || ''

  if (!task) continue

  let words = extract_words(remark)

  for (let word of words) {
    let word_entry = word_entries[word] || {
      word,
      total_occurrence: 0,
      tasks: {},
    }

    word_entry.total_occurrence++

    let task_occurrence = word_entry.tasks[task] || 0
    word_entry.tasks[task] = task_occurrence + 1

    word_entries[word] = word_entry
  }
}

/**
 * 2. infer task using remark
 */

for (let row of rows) {
  let task = row.Task || ''
  let remark = row.Remark || ''

  if (task) continue // Skip rows that already have a task

  let words = extract_words(remark)
  let taskScores: Record<string, number> = {}
  let totalScore = 0

  // Calculate scores for each task associated with the words
  for (let word of words) {
    let wordEntry = word_entries[word]
    if (!wordEntry) continue

    for (let [taskName, occurrence] of Object.entries(wordEntry.tasks)) {
      taskScores[taskName] = (taskScores[taskName] || 0) + occurrence
      totalScore += occurrence
    }
  }

  // Calculate total occurrences of all tasks
  let totalTaskOccurrences = Object.values(word_entries).reduce(
    (acc, entry) =>
      acc + Object.values(entry.tasks).reduce((sum, occ) => sum + occ, 0),
    0
  )

  // Adjust scores based on overall task occurrences
  let taskProbabilities: Record<string, number> = {}
  for (let [taskName, score] of Object.entries(taskScores)) {
    let taskTotalOccurrences = Object.values(word_entries).reduce(
      (sum, entry) => sum + (entry.tasks[taskName] || 0),
      0
    )

    let inverseFrequencyWeight =
      totalTaskOccurrences / (taskTotalOccurrences || 1)
    taskProbabilities[taskName] = (score / totalScore) * inverseFrequencyWeight
  }

  // Normalize probabilities to sum to 1
  let totalProbability = Object.values(taskProbabilities).reduce(
    (sum, prob) => sum + prob,
    0
  )
  if (totalProbability > 0) {
    for (let taskName in taskProbabilities) {
      taskProbabilities[taskName] /= totalProbability
    }
  }

  // Log tasks with their calculated probabilities
  console.log('Probable tasks for remark:', remark)
  let sortedTasks = Object.entries(taskProbabilities).sort(
    ([taskA, probA], [taskB, probB]) => probB - probA
  )

  // Filter to show top 5 tasks or those with at least 5% probability
  let filteredTasks = sortedTasks
    .filter(([taskName, probability]) => probability >= 0.05)
    .slice(0, 5)

  // Log the filtered tasks
  if (filteredTasks.length > 0) {
    for (let [taskName, probability] of filteredTasks) {
      console.log(`${taskName}: ${(probability * 100).toFixed(2)}%`)
    }
  } else {
    console.log('No tasks meet the criteria.')
  }
  console.log()
}
