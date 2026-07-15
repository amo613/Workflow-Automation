import { jest } from '@jest/globals';
import { executeHttpRequest } from '#services/full-workflow/node-handlers/http-request.handler.js';

describe('HTTP Request node handler', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses native fetch and resolves object-based node configuration', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new globalThis.Headers({
        'content-type': 'application/json',
      }),
      text: jest.fn().mockResolvedValue('{"id":101}'),
    });

    const result = await executeHttpRequest(
      {
        url: 'https://jsonplaceholder.typicode.com/users',
        method: 'POST',
        headers: { Authorization: 'Bearer {{token}}' },
        body: { name: '{{workflow.input.name}}', enabled: true },
        query_params: { source: '{{source}}' },
      },
      {
        variables: { token: 'test-token', source: 'workflow' },
        workflowInput: { name: 'Armin' },
      }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://jsonplaceholder.typicode.com/users?source=workflow',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ name: 'Armin', enabled: true }),
      }
    );
    expect(result).toMatchObject({
      success: true,
      status: 201,
      data: { id: 101 },
    });
  });

  it('continues to support JSON-string node configuration', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new globalThis.Headers(),
      text: jest.fn().mockResolvedValue('plain text'),
    });

    const result = await executeHttpRequest(
      {
        url: 'https://example.com/resource',
        headers: '{"X-Test":"{{value}}"}',
        query_params: '{"page":2}',
      },
      { variables: { value: 'resolved' } }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/resource?page=2',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Test': 'resolved',
        },
      }
    );
    expect(result.data).toBe('plain text');
  });
});
