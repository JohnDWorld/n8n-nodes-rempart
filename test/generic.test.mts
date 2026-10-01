import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildButtons, buildMessageBody, detailOf, errorMessage, statusOf } from '../nodes/Rempart/helpers.ts';

test('status is read from the raw error and from a NodeApiError', () => {
	assert.equal(statusOf({ response: { status: 401 } }), 401);
	assert.equal(statusOf({ httpCode: '409' }), 409);
	assert.equal(statusOf(new Error('boom')), undefined);
});

test('detail is the gateway text when there is one', () => {
	assert.equal(detailOf({ response: { data: 'room_id et text requis' } }), 'room_id et text requis');
	assert.equal(detailOf({ message: 'socket hang up' }), 'socket hang up');
});

test('error messages tell the user what to do', () => {
	assert.match(errorMessage(401, ''), /regenerate/);
	assert.match(errorMessage(409, ''), /webhook/i);
	assert.match(errorMessage(413, 'max 50 MB'), /too large.*50 MB/);
	assert.match(errorMessage(400, 'reply_webhook refuse (...) : ... WEBHOOK_URL'), /reachable from the internet/);
	assert.match(errorMessage(429, ''), /Too many pending questions/);
	assert.equal(errorMessage(400, 'room_id et text requis'), 'Rempart gateway error (HTTP 400): room_id et text requis');
	assert.equal(errorMessage(undefined, 'socket hang up'), 'socket hang up');
});

test('buttons: label shown, value sent, at most 8', () => {
	assert.deepEqual(buildButtons([{ label: ' Yes ', value: 'yes' }, { label: 'No' }, { label: '  ' }]), [
		{ texte: 'Yes', valeur: 'yes' },
		{ texte: 'No', valeur: 'No' },
	]);
	assert.equal(buildButtons(Array.from({ length: 12 }, (_, n) => ({ label: `b${n}` }))).length, 8);
});

test('message body only carries what was set', () => {
	assert.deepEqual(buildMessageBody('!r', 'hi'), { room_id: '!r', text: 'hi' });
	assert.deepEqual(
		buildMessageBody('!r', 'hi', { parseMode: 'markdown', replyTo: '$m', buttons: [{ texte: 'A', valeur: 'a' }] }),
		{ room_id: '!r', text: 'hi', parse_mode: 'markdown', reply_to_message_id: '$m', buttons: [{ texte: 'A', valeur: 'a' }] },
	);
});
