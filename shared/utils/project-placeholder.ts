export interface ProjectPlaceholder {
  monogram: string
  variant: 0 | 1 | 2 | 3
  label: string
}

export function createProjectPlaceholder(name: string): ProjectPlaceholder {
  const cleanName = name.trim() || 'Project'
  const words = cleanName.split(/\s+/).filter(Boolean)
  const monogram = (words.length > 1
    ? words.slice(0, 2).map(word => word[0]).join('')
    : cleanName.slice(0, 2)
  ).toUpperCase()
  const hash = [...cleanName].reduce((total, char) => total + char.charCodeAt(0), 0)
  return {
    monogram,
    variant: (hash % 4) as ProjectPlaceholder['variant'],
    label: 'Project'
  }
}
