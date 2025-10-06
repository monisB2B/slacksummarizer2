import { extractMentions } from '../src/ingest';
import { extractTasksHeuristic } from '../src/summarize';

// Mock message for testing
const mockMessage = {
  text: '<@U1234> please review this PR by tomorrow <@U5678>',
  ts: '1621573200.000000',
  permalink: 'https://example.com/archives/C1234/p1621573200000000',
  user_id: 'U9876',
};

describe('Mention extraction', () => {
  test('extracts mentions correctly from message text', () => {
    const mentions = extractMentions(mockMessage.text);
    expect(mentions).toHaveLength(2);
    expect(mentions).toContain('U1234');
    expect(mentions).toContain('U5678');
  });

  test('handles no mentions gracefully', () => {
    const mentions = extractMentions('No mentions in this message');
    expect(mentions).toHaveLength(0);
  });

  test('deduplicates repeated mentions', () => {
    const mentions = extractMentions('<@U1234> and <@U1234> again');
    expect(mentions).toHaveLength(1);
    expect(mentions).toContain('U1234');
  });
});

describe('Task extraction', () => {
  test('extracts tasks from todo patterns', () => {
    const message = {
      ...mockMessage,
      text: 'TODO: Finish the report by Friday',
    };
    
    const tasks = extractTasksHeuristic(message);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Finish the report by Friday');
  });

  test('extracts tasks from please patterns', () => {
    const tasks = extractTasksHeuristic(mockMessage);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title.toLowerCase()).toContain('review this pr by tomorrow');
  });

  test('extracts tasks from checklist patterns', () => {
    const message = {
      ...mockMessage,
      text: '[ ] Complete documentation\n[x] Fix bug',
    };
    
    const tasks = extractTasksHeuristic(message);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].title).toBe('Complete documentation');
  });

  test('extracts due dates when available', () => {
    const message = {
      ...mockMessage,
      text: 'Please complete this by next Monday',
    };
    
    const tasks = extractTasksHeuristic(message);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].due_date).not.toBeNull();
  });

  test('assigns owners when there is a single mention', () => {
    const message = {
      ...mockMessage,
      text: '<@U1234> please review this code',
    };
    
    const tasks = extractTasksHeuristic(message);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].owner_user_id).toBe('U1234');
  });
});