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
import { DEFAULT_GATEWAY_URL, gatewayFailure } from './helpers';

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
	// The gateway's answer is read here rather than from the error n8n builds on a failed
	// status: depending on the n8n version, that error no longer carries the response
	// body (n8n 2.28 drops it), and the gateway's text is what tells the user what to do.
	const options: IHttpRequestOptions = {
		method,
		url: `${base}${path}`,
		json: true,
		...extra,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body !== undefined) options.body = body;
	let response: { statusCode: number; body: unknown };
	try {
		response = await this.helpers.httpRequestWithAuthentication.call(this, 'rempartApi', options);
	} catch (error) {
		// No HTTP answer at all (network, DNS, TLS): n8n's own error already says so.
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
	const failure = gatewayFailure(response.statusCode, response.body);
	if (failure) {
		throw new NodeApiError(this.getNode(), failure as unknown as JsonObject, { ...failure, itemIndex });
	}
	return extra.returnFullResponse ? response : response.body;
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
