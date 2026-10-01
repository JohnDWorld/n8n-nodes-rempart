import type { IDataObject } from 'n8n-workflow';

export const DEFAULT_GATEWAY_URL = 'https://gateway.rempart-messenger.fr';

export const MAX_BUTTONS = 8;

export interface RempartButton {
	texte: string;
	valeur: string;
}

/**
 * Buttons under a message, in the gateway's format: the label is shown, the value is
 * what a tap sends. Without a value, the label is sent. At most 8, a phone screen
 * overflows beyond.
 */
export function buildButtons(rows: Array<{ label?: string; value?: string }>): RempartButton[] {
	return rows
		.map((row) => {
			const texte = (row.label ?? '').trim();
			return { texte, valeur: (row.value ?? '').trim() || texte };
		})
		.filter((button) => button.texte !== '')
		.slice(0, MAX_BUTTONS);
}

/** Body of POST /v1/sendMessage, with only the fields that were set. */
export function buildMessageBody(
	roomId: string,
	text: string,
	options: { parseMode?: string; replyTo?: string; buttons?: RempartButton[] } = {},
): IDataObject {
	const body: IDataObject = { room_id: roomId, text };
	if (options.parseMode) body.parse_mode = options.parseMode;
	if (options.replyTo) body.reply_to_message_id = options.replyTo;
	if (options.buttons?.length) body.buttons = options.buttons as unknown as IDataObject[];
	return body;
}

const UNIT_SECONDS: Record<string, number> = { minutes: 60, hours: 3600, days: 86400 };

/** Wait limit of "Send and Wait for Response", in seconds. */
export function waitSeconds(amount: number, unit: string): number {
	return amount * (UNIT_SECONDS[unit] ?? 3600);
}

/**
 * What "Send and Wait for Response" outputs once the gateway posts the answer. The
 * gateway's resume body is { question_id, room_id, message_id, sender, sender_name,
 * value, label, text }. room_id is kept so a following Rempart Message operation (its
 * Room ID defaults to {{ $json.room_id }}) answers in the same room, and sender (the
 * Matrix ID of whoever answered) is kept in every shape, since in a group any member
 * can answer and a workflow may need to check who. Approval buttons always carry the
 * fixed values "approve"/"decline" (see waitButtons in actions.ts), never the labels.
 */
export function resumeOutput(responseType: string, answer: IDataObject): IDataObject {
	const base: IDataObject = {
		question_id: answer.question_id,
		room_id: answer.room_id,
		message_id: answer.message_id,
		sender: answer.sender,
		sender_name: answer.sender_name,
	};
	if (responseType === 'freeText') return { ...base, text: answer.text };
	const output: IDataObject = { ...base, value: answer.value, label: answer.label };
	if (responseType === 'approval') output.approved = answer.value === 'approve';
	return output;
}

/** HTTP status of a failed call, whether n8n already wrapped the error or not. */
export function statusOf(error: unknown): number | undefined {
	const e = error as {
		httpCode?: string;
		response?: { status?: number };
		cause?: { response?: { status?: number } };
	};
	const code = e?.response?.status ?? e?.cause?.response?.status ?? (e?.httpCode ? Number(e.httpCode) : undefined);
	return Number.isFinite(code) ? code : undefined;
}

/**
 * The gateway answers errors in plain text: that text is the most useful detail. getFile
 * is read as an arraybuffer, so its error body arrives as a Buffer.
 */
export function detailOf(error: unknown): string {
	const e = error as { response?: { data?: unknown }; description?: string; message?: string };
	const raw = e?.response?.data;
	const data = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
	if (typeof data === 'string' && data) return data;
	return e?.description ?? e?.message ?? '';
}

/** What the user reads when a call fails: the cause, and what to do about it. */
export function errorMessage(status: number | undefined, detail: string): string {
	if (status === 401) {
		return 'Invalid bot token: regenerate it in Rempart > My bots and update the credential';
	}
	if (status === 409) {
		return 'A webhook is set for this bot, so messages cannot be polled: delete the webhook or use another bot';
	}
	if (status === 413) return `File too large for the server: ${detail}`;
	if (status === 400 && detail.includes('WEBHOOK_URL')) {
		return 'n8n must be reachable from the internet to receive the answer: set WEBHOOK_URL to its public address';
	}
	if (status === 429) {
		return 'Too many pending questions for this bot (100 at most): wait for answers or let some expire';
	}
	if (status !== undefined) return `Rempart gateway error (HTTP ${status}): ${detail}`;
	return detail || 'Rempart gateway error';
}

/**
 * What rempartRequest rethrows as a NodeApiError: cause, message and HTTP code.
 * httpRequestWithAuthentication already throws NodeApiError(node, axiosError), and
 * wrapping a NodeApiError again hands back the original with the new message ignored:
 * so the axios error is unwrapped first (`cause` when it is an Error, `errorResponse`
 * otherwise), and the gateway's text read from its response.
 */
export function gatewayError(error: unknown): { cause: unknown; message: string; httpCode?: string } {
	const e = error as { cause?: unknown; errorResponse?: unknown };
	const cause = e?.cause ?? e?.errorResponse ?? error;
	const status = statusOf(cause) ?? statusOf(error);
	return { cause, message: errorMessage(status, detailOf(cause)), httpCode: status ? String(status) : undefined };
}

/** Offset for the next getUpdates: last update_id plus one. The gateway drops everything below. */
export function nextOffset(updates: IDataObject[], current: number): number {
	return updates.reduce((max, update) => Math.max(max, Number(update.update_id) + 1), current);
}

/** Keeps the kinds of updates the user asked for: messages, reactions, or both. */
export function filterUpdates(updates: IDataObject[], wanted: string[]): IDataObject[] {
	return updates.filter((update) => wanted.includes(update.reaction ? 'reaction' : 'message'));
}

/** Delay before polling again after a failure: 1 s, doubling, at most 30 s. */
export function retryDelay(attempt: number): number {
	return Math.min(30_000, 1_000 * 2 ** attempt);
}

/**
 * In manual mode only the first kept update starts the test run. The gateway purges
 * everything below the acknowledged offset, so only that update's id is acknowledged:
 * the rest of the batch stays pending and is delivered on a later poll.
 */
export function manualAck(kept: IDataObject[]): { item: IDataObject; offset: number } {
	const item = kept[0];
	return { item, offset: Number(item.update_id) + 1 };
}

/**
 * The item emitted when downloading a message's attachment fails: the message itself
 * must not be lost with the rest of its batch, so it goes through without the binary
 * data, the error recorded instead.
 */
export function downloadErrorItem(update: IDataObject, error: unknown): IDataObject {
	return { ...update, download_error: error instanceof Error ? error.message : String(error) };
}
