import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class RempartApi implements ICredentialType {
	name = 'rempartApi';

	displayName = 'Rempart API';

	icon = 'file:rempart.svg' as const;

	documentationUrl = 'https://rempart-messenger.fr/api-bots.md';

	properties: INodeProperties[] = [
		{
			displayName: 'Bot Token',
			name: 'botToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Token of your Rempart bot (rmp_...), shown once when the bot is created in Rempart > My bots',
		},
		{
			displayName: 'Gateway URL',
			name: 'gatewayUrl',
			type: 'string',
			default: 'https://gateway.rempart-messenger.fr',
			description: 'Address of the Rempart bot gateway. Keep the default unless you run your own Rempart server.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.botToken}}' } },
	};

	test: ICredentialTestRequest = {
		request: { baseURL: '={{$credentials.gatewayUrl}}', url: '/v1/getMe', method: 'GET' },
	};
}
