import type { INodeProperties, IWebhookDescription } from 'n8n-workflow';

// Not a trigger: nothing is registered on a remote service. The gateway POSTs the
// answer to the signed resume URL sent with each question (same shape as n8n's own
// Send and Wait nodes).
export const sendAndWaitWebhooks: IWebhookDescription[] = [
	{
		name: 'default',
		httpMethod: 'POST',
		responseMode: 'onReceived',
		responseData: '',
		path: '={{ $nodeId }}',
		restartWebhook: true,
		isFullPath: true,
	},
];

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Message', value: 'message' },
		{ name: 'Chat', value: 'chat' },
		{ name: 'Bot', value: 'bot' },
		{ name: 'File', value: 'file' },
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
		{ name: 'Delete', value: 'delete', action: 'Delete a message', description: 'Delete a message sent by the bot' },
		{ name: 'Edit Text', value: 'editText', action: 'Edit a message', description: 'Replace the text of a message sent by the bot' },
		{ name: 'Send', value: 'send', action: 'Send a message', description: 'Send a text message, with optional buttons' },
		{
			name: 'Send and Wait for Response',
			value: 'sendAndWait',
			action: 'Send a message and wait for response',
			description: 'Ask a question and pause the workflow until someone answers in the conversation',
		},
		{ name: 'Send Document', value: 'sendDocument', action: 'Send a document', description: 'Send any file from binary data or a URL' },
		{ name: 'Send Photo', value: 'sendPhoto', action: 'Send a photo', description: 'Send an image from binary data or a URL' },
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

export const fileOperations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: ['file'] } },
	options: [
		{ name: 'Download', value: 'download', action: 'Download a file', description: 'Download a file received by the bot as binary data' },
	],
	default: 'download',
};

const sendFileShow = { show: { resource: ['message'], operation: ['sendPhoto', 'sendDocument'] } };

export const fileProperties: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: [
			{ name: 'Binary Data', value: 'binary' },
			{ name: 'URL', value: 'url' },
		],
		default: 'binary',
		displayOptions: sendFileShow,
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { resource: ['message'], operation: ['sendPhoto', 'sendDocument'], source: ['binary'] } },
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['message'], operation: ['sendPhoto', 'sendDocument'], source: ['url'] } },
		description: 'Public address of the file. The gateway downloads it.',
	},
	{ displayName: 'Caption', name: 'caption', type: 'string', default: '', displayOptions: sendFileShow },
	{
		displayName: 'Reply To Message ID',
		name: 'replyToMessageId',
		type: 'string',
		default: '',
		displayOptions: sendFileShow,
	},
	{
		displayName: 'File Reference',
		name: 'mxc',
		type: 'string',
		required: true,
		default: '={{ $json.media.mxc }}',
		displayOptions: { show: { resource: ['file'] } },
		description: 'Address (mxc://) of the file, given by the Rempart Trigger as media.mxc',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '={{ $json.media.nom }}',
		displayOptions: { show: { resource: ['file'] } },
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { resource: ['file'] } },
	},
];

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
	displayOptions: { show: { resource: ['message'], operation: ['send', 'editText', 'sendAndWait'] } },
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

const waitShow = { show: { resource: ['message'], operation: ['sendAndWait'] } };

export const waitProperties: INodeProperties[] = [
	{
		displayName: 'Response Type',
		name: 'responseType',
		type: 'options',
		options: [
			{ name: 'Approval', value: 'approval', description: 'Two buttons: approve or decline' },
			{ name: 'Choices', value: 'choices', description: 'Up to 8 buttons of your own' },
			{ name: 'Free Text', value: 'freeText', description: 'The next message (in a group, a reply quoting the question)' },
		],
		default: 'approval',
		displayOptions: waitShow,
	},
	{
		displayName: 'Approve Label',
		name: 'approveLabel',
		type: 'string',
		default: '✅ Approve',
		displayOptions: { show: { resource: ['message'], operation: ['sendAndWait'], responseType: ['approval'] } },
	},
	{
		displayName: 'Decline Label',
		name: 'declineLabel',
		type: 'string',
		default: '❌ Decline',
		displayOptions: { show: { resource: ['message'], operation: ['sendAndWait'], responseType: ['approval'] } },
	},
	{
		displayName: 'Choices',
		name: 'choices',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendAndWait'], responseType: ['choices'] } },
		options: [
			{
				displayName: 'Choice',
				name: 'choice',
				values: [
					{ displayName: 'Label', name: 'label', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '', description: 'Output as "value". Defaults to the label.' },
				],
			},
		],
	},
	{
		displayName: 'Limit Wait Time',
		name: 'limitWaitTime',
		type: 'boolean',
		default: false,
		description: 'Whether to resume the workflow without an answer after a while. It then outputs timedOut: true.',
		displayOptions: waitShow,
	},
	{
		displayName: 'Amount',
		name: 'resumeAmount',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 1,
		displayOptions: { show: { resource: ['message'], operation: ['sendAndWait'], limitWaitTime: [true] } },
	},
	{
		displayName: 'Unit',
		name: 'resumeUnit',
		type: 'options',
		options: [
			{ name: 'Minutes', value: 'minutes' },
			{ name: 'Hours', value: 'hours' },
			{ name: 'Days', value: 'days' },
		],
		default: 'hours',
		displayOptions: { show: { resource: ['message'], operation: ['sendAndWait'], limitWaitTime: [true] } },
	},
];

export const properties: INodeProperties[] = [
	resourceProperty,
	messageOperations,
	chatOperations,
	fileOperations,
	botOperations,
	roomIdProperty,
	textProperty,
	messageIdProperty,
	sendOptions,
	...fileProperties,
	...waitProperties,
];
