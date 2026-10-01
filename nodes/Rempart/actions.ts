import type { IBinaryKeyData, IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { rempartRequest } from './GenericFunctions';
import { buildButtons, buildMessageBody } from './helpers';

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
		const response = (await rempartRequest.call(
			this,
			'GET',
			`/v1/getFile?mxc=${encodeURIComponent(mxc)}`,
			undefined,
			{ encoding: 'arraybuffer', json: false, returnFullResponse: true },
		)) as { body: ArrayBuffer; headers: IDataObject };
		const binary: IBinaryKeyData = {
			[field]: await this.helpers.prepareBinaryData(
				Buffer.from(response.body),
				fileName,
				String(response.headers['content-type'] ?? ''),
			),
		};
		return [{ json: { mxc, fileName }, binary, pairedItem: i }];
	}
	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}.${operation}`, { itemIndex: i });
}
