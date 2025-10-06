import { makeSlackRequest } from '../src/ingest';
import nock from 'nock';

// Mock Slack API response for testing
const mockSlackResponse = {
  ok: true,
  messages: [
    {
      type: 'message',
      user: 'U1234',
      text: 'Hello world',
      ts: '1621573200.000000',
    },
  ],
  has_more: false,
};

// Mock rate-limited response
const rateLimitedResponse = {
  ok: false,
  error: 'ratelimited',
  retry_after: 1,
};

describe('Slack API request handling', () => {
  beforeEach(() => {
    // Reset all mocks
    nock.cleanAll();
  });

  test('retries on rate limit errors', async () => {
    const scope = nock('https://slack.com')
      // First request is rate limited
      .post('/api/conversations.history')
      .reply(429, rateLimitedResponse)
      // Second request succeeds
      .post('/api/conversations.history')
      .reply(200, mockSlackResponse);

    const requestFn = () =>
      fetch('https://slack.com/api/conversations.history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'C1234' }),
      }).then(r => r.json());

    // Use a small retry delay for testing
    const result = await makeSlackRequest(requestFn, 3, 10);
    
    expect(result).toEqual(mockSlackResponse);
    expect(scope.isDone()).toBe(true); // Ensure both requests were made
  });

  test('gives up after max retries', async () => {
    const maxRetries = 2;
    const scope = nock('https://slack.com')
      // All requests are rate limited
      .post('/api/conversations.history')
      .times(maxRetries + 1)
      .reply(429, rateLimitedResponse);

    const requestFn = () =>
      fetch('https://slack.com/api/conversations.history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'C1234' }),
      }).then(r => r.json());

    await expect(makeSlackRequest(requestFn, maxRetries, 10)).rejects.toThrow();
    expect(scope.isDone()).toBe(true); // Ensure all requests were made
  });

  test('handles pagination correctly', async () => {
    // First response has more pages
    const firstResponse = {
      ...mockSlackResponse,
      has_more: true,
      response_metadata: {
        next_cursor: 'dXNlcjpVMEc5V0ZYTlo=',
      },
    };
    
    // Second response is the last page
    const secondResponse = {
      ...mockSlackResponse,
      has_more: false,
      messages: [
        {
          type: 'message',
          user: 'U5678',
          text: 'Another message',
          ts: '1621573300.000000',
        },
      ],
    };

    const scope = nock('https://slack.com')
      .post('/api/conversations.history')
      .reply(200, firstResponse)
      .post('/api/conversations.history')
      .reply(200, secondResponse);

    // Mock implementation of paginated request
    const mockPaginatedRequest = async () => {
      const allMessages = [];
      let cursor;
      let hasMore = true;
      
      while (hasMore) {
        const requestFn = () =>
          fetch('https://slack.com/api/conversations.history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: 'C1234', cursor }),
          }).then(r => r.json());
        
        const response = await makeSlackRequest(requestFn);
        allMessages.push(...response.messages);
        hasMore = response.has_more;
        cursor = response.response_metadata?.next_cursor;
      }
      
      return allMessages;
    };

    const messages = await mockPaginatedRequest();
    
    expect(messages).toHaveLength(2);
    expect(messages[0].user).toBe('U1234');
    expect(messages[1].user).toBe('U5678');
    expect(scope.isDone()).toBe(true); // Ensure both requests were made
  });
});