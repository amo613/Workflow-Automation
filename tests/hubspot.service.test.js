import { jest } from '@jest/globals';
import { hubspotService } from '#services/hubspot.service.js';

describe('HubSpot CRM API service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('loads lists through the current 2026-03 API', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new globalThis.Response(
        JSON.stringify({
          lists: [{ listId: '12', name: 'Customers' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const lists = await hubspotService.getLists('access-token');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/lists/2026-03/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
    expect(lists).toEqual([{ listId: '12', name: 'Customers' }]);
  });

  it('adds a contact ID to a list through the current memberships API', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new globalThis.Response(
          JSON.stringify({
            results: [{ id: '321', properties: { email: 'a@example.com' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new globalThis.Response(null, { status: 204 }));

    await hubspotService.addContactToList(
      'access-token',
      'a@example.com',
      '12'
    );

    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://api.hubapi.com/crm/lists/2026-03/12/memberships/add',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(['321']),
      })
    );
  });
});
