/**
 * Utility functions for working with dates
 */

/**
 * Creates a time window for the past 24 hours
 */
export function getLast24HoursWindow(): { start: Date; end: Date } {
  const now = new Date();
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  return {
    start: oneDayAgo,
    end: now,
  };
}

/**
 * Creates a time window for a specific day
 */
export function getDayWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  
  return {
    start,
    end,
  };
}

/**
 * Creates a time window for the current week
 */
export function getCurrentWeekWindow(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Set to beginning of week (Sunday)
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  
  // Set to end of week (Saturday)
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    start,
    end,
  };
}

/**
 * Converts a Slack timestamp to a Date object
 */
export function slackTsToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000);
}

/**
 * Formats a date for Slack display
 */
export function formatDateForSlack(date: Date): string {
  // Format: "<!date^1621573200^{date_short} at {time}|May 21, 2021 at 10:00 AM>"
  const timestamp = Math.floor(date.getTime() / 1000);
  const fallback = date.toLocaleString();
  
  return `<!date^${timestamp}^{date_short} at {time}|${fallback}>`;
}

/**
 * Creates time windows for a specific period
 * e.g., daily windows for a month, hourly windows for a day
 */
export function createTimeWindows(
  start: Date,
  end: Date,
  intervalHours: number
): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  
  let currentStart = new Date(start);
  
  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setHours(currentEnd.getHours() + intervalHours);
    
    // Cap the end time at the overall end time
    const windowEnd = currentEnd > end ? end : currentEnd;
    
    windows.push({
      start: new Date(currentStart),
      end: new Date(windowEnd),
    });
    
    // Move to the next interval
    currentStart = new Date(currentEnd);
  }
  
  return windows;
}

export default {
  getLast24HoursWindow,
  getDayWindow,
  getCurrentWeekWindow,
  slackTsToDate,
  formatDateForSlack,
  createTimeWindows,
};