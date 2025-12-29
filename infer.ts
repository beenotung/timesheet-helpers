import { extract_lines } from '@beenotung/tslib/string'
import { log_sheet_file } from './config'
import { readCSV } from './fs'

/**
 * TASK INFERENCE USING TF-IDF (Term Frequency - Inverse Document Frequency)
 *
 * This system uses TF-IDF, a fundamental algorithm from Information Retrieval,
 * to predict task names for timesheet entries based on their remarks.
 *
 * TF-IDF CONCEPT:
 * - TF (Term Frequency): How important a word is within a specific remark
 * - IDF (Inverse Document Frequency): How rare/discriminative a word is across all remarks
 * - TF-IDF Score: TF × IDF - balances local relevance with global discrimination
 *
 * APPLICATION TO TASK INFERENCE:
 * - "Documents" = training remarks with known tasks
 * - "Query" = unknown remark needing task prediction
 * - "Relevance Score" = how well a task matches the unknown remark's word patterns
 *
 * WHY TF-IDF WORKS BETTER THAN SIMPLE WORD COUNTING:
 * - Gives higher weight to rare, discriminative words (e.g., "kubernetes" > "setup")
 * - Reduces noise from common words that appear in many different contexts
 * - Mathematically principled approach vs. ad-hoc weighting schemes
 *
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
  total_occurrence: number // total times this word appears across ALL remarks (raw term count)
  document_frequency: number // number of remarks containing this word (for IDF calculation)
  // task name -> occurrence count (how many times this word appeared with each task)
  tasks: Map<string, number>
  idf_score?: number // Inverse Document Frequency score (calculated after training)
}

// word -> Word Entry
let word_entries = new Map<string, Word>()

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

let symbols = '()-.,?'

function extract_words(remark: string) {
  let words = remark.split(/\s+/)
  for (let symbol of symbols) {
    words = words.map(word => word.replaceAll(symbol, ''))
  }
  return words.filter(word => word.length > 0 && !skip_words.includes(word))
}

function count_max_length(remark: string) {
  let lines = remark.split('\n')
  return lines.reduce((max, line) => Math.max(max, line.length), 0)
}

/**
 * TRAINING PHASE: Build TF-IDF model from existing task-remark pairs
 * This is like indexing documents in a search engine
 */
let total_remarks = 0 // Total number of training "documents" (remarks with known tasks)

for (let row of rows) {
  let task = row.Task || ''
  let remark = row.Remark || ''

  if (!task) continue

  total_remarks++
  let words = extract_words(remark)
  let unique_words = new Set(words) // Track unique words per remark for document frequency

  // FIRST PASS: Update document frequency (DF)
  // DF counts how many training remarks contain each word
  // This is needed for IDF calculation: IDF = log(N/DF)
  for (let word of unique_words) {
    let word_entry = word_entries.get(word)
    if (!word_entry) {
      word_entry = {
        word,
        total_occurrence: 0,
        document_frequency: 0,
        tasks: new Map<string, number>(),
      }
      word_entries.set(word, word_entry)
    }

    word_entry.document_frequency++ // Increment once per remark containing this word
  }

  // SECOND PASS: Update term frequencies and task associations
  // Count how often each word appears and with which tasks
  for (let word of words) {
    let word_entry = word_entries.get(word)!

    word_entry.total_occurrence++ // Total times this word appears across all remarks

    let task_occurrence = word_entry.tasks.get(task) || 0
    word_entry.tasks.set(task, task_occurrence + 1) // How often this word appears with this task
  }
}

/**
 * PRE-CALCULATE IDF SCORES (Inverse Document Frequency)
 *
 * IDF measures how "rare" or discriminative a word is across all training data.
 * Formula: IDF = log(total_documents / documents_containing_word)
 *
 * Why IDF matters:
 * - Common words (like "the", "and") have low IDF → less useful for distinguishing tasks
 * - Rare words (like "kubernetes", "authentication") have high IDF → very discriminative
 * - This prevents common words from dominating the scoring
 *
 * Example: If "setup" appears in 100/1000 remarks, IDF = log(1000/100) = log(10) ≈ 2.3
 *          If "kubernetes" appears in 5/1000 remarks, IDF = log(1000/5) = log(200) ≈ 5.3
 */
for (let [word, entry] of word_entries) {
  entry.idf_score = Math.log(total_remarks / entry.document_frequency)
}

/**
 * INFERENCE PHASE: Use TF-IDF to predict tasks for unknown remarks
 *
 * This is like search engine query processing:
 * - Unknown remark = search query
 * - Training remarks = indexed documents
 * - Tasks = document categories we want to predict
 */

for (let row of rows) {
  let task = row.Task || ''
  let remark = row.Remark || ''

  if (task) continue // Skip rows that already have a task

  let words = extract_words(remark)

  // Skip remarks that have no meaningful words after filtering
  if (words.length === 0) continue

  // STEP 1: Calculate Term Frequency (TF) for this remark
  // TF measures how important each word is WITHIN this specific remark
  // Formula: TF = word_count_in_remark / total_words_in_remark
  let wordFreq = new Map<string, number>()
  for (let word of words) {
    let freq = wordFreq.get(word) || 0
    wordFreq.set(word, freq + 1)
  }
  let totalWordsInRemark = words.length

  // STEP 2: Calculate TF-IDF scores and distribute to tasks
  // task -> score
  let taskScores = new Map<string, number>()

  for (let word of wordFreq.keys()) {
    let wordEntry = word_entries.get(word)
    if (!wordEntry) continue // skip unknown words (words that are not in the training data)

    // word frequency in the current remark
    let freq = wordFreq.get(word)!

    // TF: How frequent is this word in the current remark?
    let tf = freq / totalWordsInRemark

    // IDF: How rare/discriminative is this word globally?
    // (Pre-calculated during training phase and stored in Word object)
    let idf = wordEntry.idf_score || 0

    // TF-IDF: Combine local importance (TF) with global rarity (IDF)
    // High TF-IDF = word is both frequent here AND rare globally
    // This gives more weight to discriminative words that are relevant to this remark
    let tfidf = tf * idf

    // Distribute this word's TF-IDF score to all tasks it's associated with
    // Weight by co-occurrence strength: tasks that frequently appear with this word get more score
    for (let [taskName, coOccurrenceCount] of wordEntry.tasks) {
      let weightedScore = tfidf * coOccurrenceCount
      let currentScore = taskScores.get(taskName) || 0
      taskScores.set(taskName, currentScore + weightedScore)
    }
  }

  // STEP 3: Convert raw TF-IDF scores to probabilities
  // Normalize by total score so probabilities sum to 1
  // This gives us a proper probability distribution over possible tasks
  // task -> probability
  let taskProbabilities = new Map<string, number>()
  let totalScore = 0
  for (let score of taskScores.values()) {
    totalScore += score
  }

  if (totalScore > 0) {
    for (let [taskName, score] of taskScores) {
      taskProbabilities.set(taskName, score / totalScore)
    }
  }

  // Normalize probabilities to sum to 1
  let totalProbability = 0
  for (let prob of taskProbabilities.values()) {
    totalProbability += prob
  }
  if (totalProbability > 0) {
    for (let taskName in taskProbabilities) {
      let prob = taskProbabilities.get(taskName)!
      taskProbabilities.set(taskName, prob / totalProbability)
    }
  }

  // Log tasks with their calculated probabilities
  console.log('Probable tasks for remark:')
  let line_length = count_max_length(remark)
  console.log('-'.repeat(line_length))
  console.log(remark)
  console.log('-'.repeat(line_length))
  let sortedTasks = Array.from(taskProbabilities.entries()).sort(
    ([taskA, probA], [taskB, probB]) => probB - probA,
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
