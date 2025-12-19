export type TagCategory = {
  name: string
  variants: string[]
}

export let tag_categories: TagCategory[] = []

tag_categories.push({
  name: 'dev',
  variants: [
    'feat',
    'wip',
    'exp',
    'chore',
    'patch',
    'ui',
    'data',
    'db',
    'seed',
    'perf',
    'debug',
  ],
})

tag_categories.push({
  name: 'devop',
  variants: ['ci', 'deploy'],
})

export let typo_tags: Record<string, string> = {
  faet: 'feat',
  taem: 'team',
  opeartion: 'operation',
  adocs: 'operation',
}

export function mapTag(tag: string): string {
  tag = typo_tags[tag] || tag
  for (let tag_category of tag_categories) {
    if (tag_category.variants.includes(tag)) {
      return tag_category.name + ':' + tag
    }
  }
  return tag
}
