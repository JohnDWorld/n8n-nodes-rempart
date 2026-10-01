import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadErrorItem, filterUpdates, manualAck, nextOffset, retryDelay } from '../nodes/Rempart/helpers.ts';

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

test('manual mode starts on the first kept update and acknowledges only it', () => {
	const kept = [{ update_id: 7 }, { update_id: 9 }];
	assert.deepEqual(manualAck(kept), { item: { update_id: 7 }, offset: 8 });
});

test('a failed download keeps the message, with the error recorded instead of the file', () => {
	const update = { text: 'hi', media: { mxc: 'mxc://x' } };
	assert.deepEqual(downloadErrorItem(update, new Error('socket hang up')), {
		text: 'hi',
		media: { mxc: 'mxc://x' },
		download_error: 'socket hang up',
	});
	assert.equal(downloadErrorItem({}, 'boom').download_error, 'boom');
});
