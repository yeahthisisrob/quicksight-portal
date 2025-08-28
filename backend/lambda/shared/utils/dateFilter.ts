import { TIME_UNITS } from '../constants';

export function filterByDateRange(
  items: any[],
  dateRange: string,
  dateField: string = 'lastModified'
): any[] {
  if (!dateRange || dateRange === 'all') {
    return items;
  }

  const now = new Date();
  let startDate: Date;

  switch (dateRange) {
    case '24h':
      startDate = new Date(now.getTime() - TIME_UNITS.DAY);
      break;
    case '7d':
      startDate = new Date(now.getTime() - TIME_UNITS.WEEK);
      break;
    case '30d':
      startDate = new Date(now.getTime() - TIME_UNITS.MONTH_30_DAYS);
      break;
    case '90d':
      startDate = new Date(now.getTime() - TIME_UNITS.QUARTER_90_DAYS);
      break;
    default:
      return items;
  }

  return items.filter((item) => {
    // Try multiple date fields
    const dateValue =
      item[dateField] ||
      item.metadata?.lastUpdatedTime ||
      item.lastUpdatedTime ||
      item.lastModified ||
      item.createdTime;

    if (!dateValue) {
      return false;
    }

    const itemDate = new Date(dateValue);
    return itemDate >= startDate && itemDate <= now;
  });
}
