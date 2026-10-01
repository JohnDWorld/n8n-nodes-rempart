import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ITriggerFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { DEFAULT_GATEWAY_URL, gatewayError } from './helpers';

/** Calls the Rempart bot gateway with the bot token of the credential. */
export async function rempartRequest(
	this: IExecuteFunctions | ITriggerFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	extra: Partial<IHttpRequestOptions> = {},
	itemIndex?: number,
): Promise<unknown> {
	const credentials = await this.getCredentials('rempartApi');
	const base = String(credentials.gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
	const options: IHttpRequestOptions = { method, url: `${base}${path}`, json: true, ...extra };
	if (body !== undefined) options.body = body;
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'rempartApi', options);
	} catch (error) {
		const { cause, message, httpCode } = gatewayError(error);
		throw new NodeApiError(this.getNode(), cause as JsonObject, { message, httpCode, itemIndex });
	}
}

/** Downloads and decrypts a Rempart media file, ready to attach as binary data. */
export async function downloadFile(
	this: IExecuteFunctions | ITriggerFunctions,
	mxc: string,
	fileName: string,
	itemIndex?: number,
): Promise<IBinaryData> {
	const response = (await rempartRequest.call(
		this,
		'GET',
		`/v1/getFile?mxc=${encodeURIComponent(mxc)}`,
		undefined,
		{ encoding: 'arraybuffer', json: false, returnFullResponse: true },
		itemIndex,
	)) as { body: ArrayBuffer; headers: IDataObject };
	return await this.helpers.prepareBinaryData(
		Buffer.from(response.body),
		fileName || 'file',
		String(response.headers['content-type'] ?? ''),
	);
}
