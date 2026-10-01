import type { INodeProperties } from 'n8n-workflow';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Message', value: 'message' },
		{ name: 'Chat', value: 'chat' },
		{ name: 'Bot', value: 'bot' },
	],
	default: 'message',
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

export const messageOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['message'] } },
	options: [
		{ name: 'Send', value: 'send', action: 'Send a message', description: 'Send a text message, with optional buttons' },
		{ name: 'Edit Text', value: 'editText', action: 'Edit a message', description: 'Replace the text of a message sent by the bot' },
		{ name: 'Delete', value: 'delete', action: 'Delete a message', description: 'Delete a message sent by the bot' },
	],
	default: 'send',
};

export const chatOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['chat'] } },
	options: [
		{ name: 'Send Typing', value: 'sendTyping', action: 'Show typing', description: 'Show "typing" in the conversation, for about 30 seconds' },
	],
	default: 'sendTyping',
};

export const roomIdProperty: INodeProperties = {
	displayName: 'Room ID',
	name: 'roomId',
	type: 'string',
	required: true,
	default: '={{ $json.room_id }}',
	displayOptions: { show: { resource: ['message', 'chat'] } },
	description: 'Conversation to write to. The Rempart Trigger gives it as room_id.',
};

export const textProperty: INodeProperties = {
	displayName: 'Text',
	name: 'text',
	type: 'string',
	required: true,
	typeOptions: { rows: 4 },
	default: '',
	displayOptions: { show: { resource: ['message'], operation: ['send', 'editText'] } },
};

export const messageIdProperty: INodeProperties = {
	displayName: 'Message ID',
	name: 'messageId',
	type: 'string',
	required: true,
	default: '={{ $json.event_id }}',
	displayOptions: { show: { resource: ['message'], operation: ['editText', 'delete'] } },
	description: 'ID of a message sent by the bot (event_id returned by Send)',
};

const parseModeOption: INodeProperties = {
	displayName: 'Format',
	name: 'parseMode',
	type: 'options',
	options: [
		{ name: 'Plain Text', value: '' },
		{ name: 'Markdown', value: 'markdown' },
		{ name: 'HTML', value: 'html' },
	],
	default: '',
};

export const sendOptions: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: { show: { resource: ['message'], operation: ['send', 'editText'] } },
	options: [
		parseModeOption,
		{
			displayName: 'Reply To Message ID',
			name: 'replyToMessageId',
			type: 'string',
			default: '',
			description: 'Quote this message (message_id given by the Rempart Trigger)',
			displayOptions: { show: { '/operation': ['send'] } },
		},
		{
			displayName: 'Buttons',
			name: 'buttons',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true },
			default: {},
			description:
				'Up to 8 buttons. A tap sends the value as a message. Keep the text understandable without them: other Matrix apps do not show buttons.',
			displayOptions: { show: { '/operation': ['send'] } },
			options: [
				{
					displayName: 'Button',
					name: 'button',
					values: [
						{ displayName: 'Label', name: 'label', type: 'string', default: '' },
						{ displayName: 'Value', name: 'value', type: 'string', default: '', description: 'Sent when tapped. Defaults to the label.' },
					],
				},
			],
		},
	],
};

export const properties: INodeProperties[] = [
	resourceProperty,
	messageOperations,
	chatOperations,
	botOperations,
	roomIdProperty,
	textProperty,
	messageIdProperty,
	sendOptions,
];
