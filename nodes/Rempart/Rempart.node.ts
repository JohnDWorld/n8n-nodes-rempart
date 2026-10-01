import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { runOperation } from './actions';
import { properties } from './descriptions';

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
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
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
}
