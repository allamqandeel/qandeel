/**
 * S8A-04 CP3-C — the permissions wire: the decoder of the reader's OWN view and the exact command bodies. Inside the
 * runtime-entry layer; consumers reach it only through the barrel.
 */
import {
  decodeSharedPermissions, sharedPermissionAllowBody, sharedPermissionAnswerBody,
} from '../shared-permissions-api';

const REQUEST = '88888888-8888-4888-8888-888888888888';
const ITEM = '99999999-9999-4999-8999-999999999999';
const ITEM_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REF = `sha256:${'c'.repeat(64)}`;

describe('S8A-04 CP3-C — the decoder', () => {
  const body = { outcome: 'READ', audienceRef: REF, members: ['Hala'], requests: [{ requestId: REQUEST, itemId: ITEM, text: 'x' }],
    allowed: [], reconfirm: [], declined: [], ended: [{ itemId: ITEM_2, text: null, reason: 'FORGOTTEN' }] };
  it('reads exactly the READ view', () => {
    const result = decodeSharedPermissions(body);
    expect(result.kind).toBe('READ');
    expect(decodeSharedPermissions({ outcome: 'UNAVAILABLE' })).toEqual({ kind: 'DENIED' });
  });
  it('anything else is no answer: a user id, an extra key, an unknown ending, a malformed reference, nothing to answer about', () => {
    for (const bad of [
      { ...body, ownerUserId: ITEM }, { ...body, requests: [{ requestId: REQUEST, itemId: ITEM, text: 'x', ownerId: ITEM }] },
      { ...body, ended: [{ itemId: ITEM_2, text: null, reason: 'EXPIRED' }] }, { ...body, audienceRef: 'sha256:x' },
      { ...body, audienceRef: null }, { ...body, members: [''] }, { ...body, members: [null] },
      { ...body, reconfirm: [{ itemId: ITEM, text: 'x', newMembers: [] }] }, null, [],
    ]) {
      expect(decodeSharedPermissions(bad).kind).toBe('UNAVAILABLE');
    }
  });
});

describe('S8A-04 CP3-C — the command bodies', () => {
  it('Allow carries the opaque reference; No carries none; nothing else is ever sent', () => {
    expect(sharedPermissionAnswerBody('c1', 'ALLOW', REF)).toEqual({ commandId: 'c1', decision: 'ALLOW', audienceRef: REF });
    expect(sharedPermissionAnswerBody('c2', 'DECLINE', REF)).toEqual({ commandId: 'c2', decision: 'DECLINE' });
    expect(sharedPermissionAllowBody('c3', REF)).toEqual({ commandId: 'c3', audienceRef: REF });
  });
});
