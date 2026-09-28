import { JournalEntry, EntrySortMode } from '../types';

/**
 * Sorts journal entries based on the given sort mode.
 * - 'date_asc': Oldest to newest (chronological travel route from start to destination)
 * - 'date_desc': Newest to oldest (most recent memories first)
 * - 'custom': User-defined custom sequence (by orderIndex, falling back to date_asc)
 * - 'title_asc': Alphabetical by title/location
 */
export function sortJournalEntries(entries: JournalEntry[], mode: EntrySortMode = 'date_asc'): JournalEntry[] {
  const list = [...entries];

  switch (mode) {
    case 'date_desc':
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    case 'title_asc':
      return list.sort((a, b) =>
        (a.title || a.locationName).localeCompare(b.title || b.locationName, 'de')
      );

    case 'custom':
      return list.sort((a, b) => {
        const orderA = a.orderIndex !== undefined ? a.orderIndex : new Date(a.date).getTime();
        const orderB = b.orderIndex !== undefined ? b.orderIndex : new Date(b.date).getTime();
        return orderA - orderB;
      });

    case 'date_asc':
    default:
      return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

/**
 * Moves an entry one step up or down in the custom sequence and returns the updated entries list with recalculated orderIndex.
 */
export function moveEntryInList(
  entries: JournalEntry[],
  entryId: string,
  direction: 'up' | 'down'
): JournalEntry[] {
  const currentList = [...entries];
  const index = currentList.findIndex((e) => e.id === entryId);
  if (index === -1) return entries;

  if (direction === 'up' && index > 0) {
    const item = currentList.splice(index, 1)[0];
    currentList.splice(index - 1, 0, item);
  } else if (direction === 'down' && index < currentList.length - 1) {
    const item = currentList.splice(index, 1)[0];
    currentList.splice(index + 1, 0, item);
  } else {
    return entries; // No movement possible
  }

  // Update orderIndex for all entries in the list
  return currentList.map((entry, idx) => ({
    ...entry,
    orderIndex: idx,
    updatedAt: new Date().toISOString(),
  }));
}
