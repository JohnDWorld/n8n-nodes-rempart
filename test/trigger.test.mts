import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterUpdates, nextOffset, retryDelay } from '../nodes/Rempart/helpers.ts';

test('offset is the last update_id plus one', () => {
	assert.equal(nextOffset([{ update_id: 7 }, { update_id: 9 }], 0), 10);
	assert.equal(nextOffset([], 5), 5);
});

test('only the requested kinds of updates are kept', () => {
	const updates = [{ text: 'hi' }, { text: '', reaction: { symbole: '✅' } }];
	assert.equal(filterUpdates(updates, ['message']).length, 1);
	assert.equal(filterUpdates(updates, ['reaction'])[0].reaction !== undefined, true);
	assert.equal(filterUpdates(updates, ['message', 'reaction']).length, 2);
});

test('retry delay doubles from 1 s and stops at 30 s', () => {
	assert.deepEqual([0, 1, 2, 5, 10].map(retryDelay), [1000, 2000, 4000, 30000, 30000]);
});
