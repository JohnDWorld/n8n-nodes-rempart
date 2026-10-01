import type { INodeProperties } from 'n8n-workflow';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [{ name: 'Bot', value: 'bot' }],
	default: 'bot',
};

export const botOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['bot'] } },
	options: [
		{
			name: 'Get Info',
			value: 'getInfo',
			action: 'Get bot info',
			description: 'Name, Matrix address, description and commands of the bot',
		},
	],
	default: 'getInfo',
};

export const properties: INodeProperties[] = [resourceProperty, botOperations];
