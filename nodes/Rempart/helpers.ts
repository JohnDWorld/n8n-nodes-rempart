export const DEFAULT_GATEWAY_URL = 'https://gateway.rempart-messenger.fr';

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

/** The gateway answers errors in plain text: that text is the most useful detail. */
export function detailOf(error: unknown): string {
	const e = error as { response?: { data?: unknown }; description?: string; message?: string };
	const data = e?.response?.data;
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
