import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
	buildButtons,
	buildMessageBody,
	detailOf,
	errorMessage,
	gatewayError,
	resumeOutput,
	statusOf,
	waitSeconds,
} from '../nodes/Rempart/helpers.ts';

// The real class: n8n-workflow's ESM build does not load under plain node, its CJS build does.
const { NodeApiError } = createRequire(import.meta.url)('n8n-workflow');
const node = { id: '1', name: 'Rempart', type: 'n8n-nodes-rempart.rempart', typeVersion: 1, position: [0, 0], parameters: {} };

// n8n-core's httpRequestWithAuthentication throws new NodeApiError(node, axiosError),
// then rempartRequest rethrows what gatewayError gives.
function rethrown(axiosError: unknown) {
	const { cause, message, httpCode } = gatewayError(new NodeApiError(node, axiosError));
	return new NodeApiError(node, cause, { message, httpCode });
}

test('the gateway message survives n8n wrapping the axios error first', () => {
	const axiosError = Object.assign(new Error('Request failed with status code 400'), {
		response: {
			status: 400,
			// gateway.py: HTTPBadRequest(text=f'reply_webhook refusé ({e.text}) : {N8N_INJOIGNABLE}')
			data: "reply_webhook refusé (adresse non publique) : votre n8n doit être joignable depuis Internet pour recevoir la réponse : réglez WEBHOOK_URL sur son adresse publique",
		},
	});
	const error = rethrown(axiosError);
	assert.match(error.message, /reachable from the internet/);
	assert.equal(error.httpCode, '400');
});

test('a 409 is still told apart, and still stops the trigger', () => {
	const error = rethrown({ message: 'Request failed with status code 409', response: { status: 409, data: 'webhook actif' } });
	assert.match(error.message, /A webhook is set for this bot/);
	assert.equal(statusOf(error), 409);
});

test('status is read from the raw error and from a NodeApiError', () => {
	assert.equal(statusOf({ response: { status: 401 } }), 401);
	assert.equal(statusOf({ httpCode: '409' }), 409);
	assert.equal(statusOf(new Error('boom')), undefined);
});

test('detail is the gateway text when there is one', () => {
	assert.equal(detailOf({ response: { data: 'room_id et text requis' } }), 'room_id et text requis');
	assert.equal(detailOf({ message: 'socket hang up' }), 'socket hang up');
	// getFile is read as an arraybuffer: its error body arrives as a Buffer.
	assert.equal(detailOf({ response: { data: Buffer.from('fichier introuvable') } }), 'fichier introuvable');
});

test('error messages tell the user what to do', () => {
	assert.match(errorMessage(401, ''), /regenerate/);
	assert.match(errorMessage(409, ''), /webhook/i);
	assert.match(errorMessage(413, 'max 50 MB'), /too large.*50 MB/);
	assert.match(errorMessage(400, 'reply_webhook refuse (...) : ... WEBHOOK_URL'), /reachable from the internet/);
	assert.match(errorMessage(429, ''), /Too many pending questions/);
	assert.equal(errorMessage(400, 'room_id et text requis'), 'Rempart gateway error (HTTP 400): room_id et text requis');
	assert.equal(errorMessage(undefined, 'socket hang up'), 'socket hang up');
	assert.equal(errorMessage(undefined, ''), 'Rempart gateway error');
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

test('wait limit in seconds', () => {
	assert.equal(waitSeconds(2, 'minutes'), 120);
	assert.equal(waitSeconds(1, 'hours'), 3600);
	assert.equal(waitSeconds(1, 'days'), 86400);
	assert.equal(waitSeconds(2, 'unknown'), 7200);
});

test('resume output per response type', () => {
	const base = {
		question_id: '$q',
		room_id: '!r:rempart-messenger.fr',
		message_id: '$m',
		sender: '@u_x:rempart-messenger.fr',
		sender_name: 'Bérénice',
	};
	assert.deepEqual(resumeOutput('approval', { ...base, value: 'approve', label: '✅ Approve' }), {
		...base,
		value: 'approve',
		label: '✅ Approve',
		approved: true,
	});
	assert.deepEqual(resumeOutput('approval', { ...base, value: 'decline', label: '❌ Decline' }), {
		...base,
		value: 'decline',
		label: '❌ Decline',
		approved: false,
	});
	assert.deepEqual(resumeOutput('choices', { ...base, value: 'tuesday', label: 'Tuesday' }), {
		...base,
		value: 'tuesday',
		label: 'Tuesday',
	});
	assert.deepEqual(resumeOutput('freeText', { ...base, text: 'Thursday' }), {
		...base,
		text: 'Thursday',
	});
});
