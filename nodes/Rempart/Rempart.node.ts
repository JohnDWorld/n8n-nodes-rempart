import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { runOperation, sendAndWait } from './actions';
import { properties, sendAndWaitWebhooks } from './descriptions';
import { resumeOutput } from './helpers';

export class Rempart implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rempart',
		name: 'rempart',
		icon: { light: 'file:rempart.svg', dark: 'file:rempart.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Send messages and files with a Rempart bot, and wait for answers',
		defaults: { name: 'Rempart' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'rempartApi', required: true }],
		webhooks: sendAndWaitWebhooks,
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		if (resource === 'message' && operation === 'sendAndWait') return await sendAndWait.call(this);
		const results: INodeExecutionData[] = [];
		for (let i = 0; i < this.getInputData().length; i++) {
			try {
				results.push(...(await runOperation.call(this, resource, operation, i)));
			} catch (error) {
				if (this.continueOnFail()) {
					results.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				// Rule of the n8n linter: never rethrow raw. NodeApiError hands back the
				// original when it already is one, so the gateway's message is kept.
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [results];
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const responseType = this.getNodeParameter('responseType', 'approval') as string;
		const approveValue = ((this.getNodeParameter('approveLabel', '✅ Approve') as string) ?? '').trim();
		const answer = this.getBodyData() as IDataObject;
		return { workflowData: [[{ json: resumeOutput(responseType, answer, approveValue) }]] };
	}
}
