# timesheet-helpers

Helper functions and cli for timesheet.

[![npm Package Version](https://img.shields.io/npm/v/timesheet-helpers)](https://www.npmjs.com/package/timesheet-helpers)

## Features

- CLI operations
  - Convert timesheet from text to csv
  - Summarize and merge time spent on each project and task
- Typescript support
- Isomorphic package: works in Node.js and browsers

## Installation

TODO: this package is not setup for npm yet.

```bash
npm install timesheet-helpers
```

You can also install `timesheet-helpers` with [pnpm](https://pnpm.io/), [yarn](https://yarnpkg.com/), or [slnpm](https://github.com/beenotung/slnpm)

## Usage Example

Convert from `res/log-sheet.csv` to summary files in `res/summary/` directory:

- `Task.all.csv`, `Task.2024.csv`, `Task.2025.csv` (and more years)
- `Tag.all.csv`, `Tag.2024.csv`, `Tag.2025.csv` (and more years)

```bash
npx ts-node summarize
```

Merge stats of same task in `res/summary.csv`

```bash
npx ts-node merge
```

Convert from `~/timesheet.txt` to `res/draft.csv`

```bash
npx ts-node from-text
```

TODO: no exported functions yet.

```typescript
import {} from 'timesheet-helpers'
```

## Typescript Signature

TODO: no exported types yet.

```typescript

```
