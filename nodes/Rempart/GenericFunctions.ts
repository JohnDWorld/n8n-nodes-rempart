import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ITriggerFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { DEFAULT_GATEWAY_URL, detailOf, errorMessage, statusOf } from './helpers';

/** Calls the Rempart bot gateway with the bot token of the credential. */
export async function rempartRequest(
	this: IExecuteFunctions | ITriggerFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	extra: Partial<IHttpRequestOptions> = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('rempartApi');
	const base = String(credentials.gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
	const options: IHttpRequestOptions = { method, url: `${base}${path}`, json: true, ...extra };
	if (body !== undefined) options.body = body;
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'rempartApi', options);
	} catch (error) {
		const status = statusOf(error);
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: errorMessage(status, detailOf(error)),
			httpCode: status ? String(status) : undefined,
		});
	}
}
