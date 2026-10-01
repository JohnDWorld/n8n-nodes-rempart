import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { rempartRequest } from './GenericFunctions';

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
	throw new NodeOperationError(this.getNode(), `Unsupported operation: ${resource}.${operation}`, { itemIndex: i });
}
