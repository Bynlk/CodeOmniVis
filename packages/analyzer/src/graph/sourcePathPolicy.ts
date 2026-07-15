const TEST_FILE_MARKERS = ['.test.', '.spec.', '.cy.']
const TEST_ONLY_SEGMENTS = new Set(['__tests__', 'e2e'])

export function isTestSourcePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/gu, '/').toLowerCase()
  const segments = normalized.split('/').filter(Boolean)
  return (
    segments.some((segment) => TEST_ONLY_SEGMENTS.has(segment)) ||
    TEST_FILE_MARKERS.some((marker) => normalized.includes(marker))
  )
}
