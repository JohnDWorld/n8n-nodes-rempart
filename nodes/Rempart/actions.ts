import type { IBinaryKeyData, IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError, WAIT_INDEFINITELY } from 'n8n-workflow';
import { downloadFile, rempartRequest } from './GenericFunctions';
import { buildButtons, buildMessageBody, waitSeconds, type RempartButton } from './helpers';

/** Runs one operation for one input item. */
export async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'bot' && operation === 'getInfo') {
		return [{ json: (await rempartRequest.call(this, 'GET', '/v1/getMe')) as IDataObject, pairedItem: i }];
	}
	const call = async (path: string, body: IDataObject) => [
		{ json: (await rempartRequest.call(this, 'POST', path, body)) as IDataObject, pairedItem: i },
	];
	if (resource === 'chat' && operation === 'sendTyping') {
		return await call('/v1/sendChatAction', { room_id: this.getNodeParameter('roomId', i), action: 'typing' });
	}
	if (resource === 'message' && operation === 'send') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const rows = ((options.buttons as IDataObject | undefined)?.button ?? []) as Array<{ label?: string; value?: string }>;
		return await call(
			'/v1/sendMessage',
			buildMessageBody(this.getNodeParameter('roomId', i) as string, this.getNodeParameter('text', i) as string, {
				parseMode: options.parseMode as string | undefined,
				replyTo: options.replyToMessageId as string | undefined,
				buttons: buildButtons(rows),
			}),
		);
	}
	if (resource === 'message' && operation === 'editText') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const body: IDataObject = {
			room_id: this.getNodeParameter('roomId', i),
			message_id: this.getNodeParameter('messageId', i),
			text: this.getNodeParameter('text', i),
		};
		if (options.parseMode) body.parse_mode = options.parseMode;
		return await call('/v1/editMessageText', body);
	}
	if (resource === 'message' && operation === 'delete') {
		return await call('/v1/deleteMessage', {
			room_id: this.getNodeParameter('roomId', i),
			message_id: this.getNodeParameter('messageId', i),
		});
	}
	if (resource === 'message' && (operation === 'sendPhoto' || operation === 'sendDocument')) {
		const body: IDataObject = { room_id: this.getNodeParameter('roomId', i) };
		const caption = this.getNodeParameter('caption', i, '') as string;
		if (caption) body.caption = caption;
		const replyTo = this.getNodeParameter('replyToMessageId', i, '') as string;
		if (replyTo) body.reply_to_message_id = replyTo;
		if (this.getNodeParameter('source', i) === 'url') {
			body.url = this.getNodeParameter('fileUrl', i);
		} else {
			const field = this.getNodeParameter('binaryPropertyName', i) as string;
			const binary = this.helpers.assertBinaryData(i, field);
			const buffer = await this.helpers.getBinaryDataBuffer(i, field);
			body.data_base64 = buffer.toString('base64');
			body.content_type = binary.mimeType;
			if (binary.fileName) body.filename = binary.fileName;
		}
		return await call(operation === 'sendPhoto' ? '/v1/sendPhoto' : '/v1/sendDocument', body);
	}
	if (resource === 'file' && operation === 'download') {
		const mxc = this.getNodeParameter('mxc', i) as string;
		const fileName = (this.getNodeParameter('fileName', i, '') as string) || 'file';
		const field = this.getNodeParameter('binaryPropertyName', i) as string;
		const binary: IBinaryKeyData = { [field]: await downloadFile.call(this, mxc, fileName) };
		return [{ json: { mxc, fileName }, binary, pairedItem: i }];
	}
	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}.${operation}`, { itemIndex: i });
}

function waitButtons(this: IExecuteFunctions, responseType: string): RempartButton[] {
	if (responseType === 'approval') {
		const approveLabel = ((this.getNodeParameter('approveLabel', 0) as string) ?? '').trim();
		const declineLabel = ((this.getNodeParameter('declineLabel', 0) as string) ?? '').trim();
		if (!approveLabel || !declineLabel) {
			throw new NodeOperationError(this.getNode(), 'Both the approve and the decline labels are required');
		}
		// Fixed values, never the labels: Rempart.webhook reads only responseType (no
		// input item is available when the resume webhook runs, so approveLabel cannot
		// be re-read there), and resumeOutput compares against 'approve' directly.
		return buildButtons([
			{ label: approveLabel, value: 'approve' },
			{ label: declineLabel, value: 'decline' },
		]);
	}
	if (responseType === 'choices') {
		return buildButtons(this.getNodeParameter('choices.choice', 0, []) as Array<{ label?: string; value?: string }>);
	}
	return [];
}

/**
 * Sends the question, then pauses the execution. The gateway calls the signed resume
 * URL with the answer (see Rempart.webhook). Only the first input item is used, like
 * the official "Send and Wait" operations.
 */
export async function sendAndWait(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const responseType = this.getNodeParameter('responseType', 0) as string;
	const buttons = waitButtons.call(this, responseType);
	if (responseType !== 'freeText' && !buttons.length) {
		throw new NodeOperationError(this.getNode(), 'Add at least one choice');
	}
	const body = buildMessageBody(
		this.getNodeParameter('roomId', 0) as string,
		this.getNodeParameter('text', 0) as string,
		{ buttons },
	);
	body.reply_webhook = this.getSignedResumeUrl();
	body.reply_mode = responseType === 'freeText' ? 'text' : 'buttons';
	let waitTill = WAIT_INDEFINITELY;
	if (this.getNodeParameter('limitWaitTime', 0, false)) {
		const seconds = waitSeconds(
			this.getNodeParameter('resumeAmount', 0, 1) as number,
			this.getNodeParameter('resumeUnit', 0, 'hours') as string,
		);
		waitTill = new Date(Date.now() + seconds * 1000);
		body.reply_expires_at = Math.floor(waitTill.getTime() / 1000);
	}
	await rempartRequest.call(this, 'POST', '/v1/sendMessage', body);
	await this.putExecutionToWait(waitTill);
	// n8n's engine (WorkflowExecute.handleWaitingState) discards whatever this
	// returns once the execution resumes: on an answer, Rempart.webhook's return
	// value is used instead; on a timeout, the engine pops this node's run data and
	// emits its input items unchanged regardless of what is returned here. Returning
	// them anyway matches n8n's own Send and Wait nodes.
	return [this.getInputData()];
}
