import type {
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes, sleep } from 'n8n-workflow';
import { rempartRequest } from '../Rempart/GenericFunctions';
import { filterUpdates, nextOffset, retryDelay, statusOf } from '../Rempart/helpers';

export class RempartTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Rempart Trigger',
		name: 'rempartTrigger',
		icon: { light: 'file:rempart.svg', dark: 'file:rempart.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{ $parameter["updates"].join(", ") }}',
		description: 'Starts the workflow when your Rempart bot receives a message',
		defaults: { name: 'Rempart Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'rempartApi', required: true }],
		properties: [
			{
				displayName:
					'Only one active workflow per bot: two workflows polling the same bot would share its messages.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Trigger On',
				name: 'updates',
				type: 'multiOptions',
				options: [
					{ name: 'Message', value: 'message' },
					{ name: 'Reaction', value: 'reaction' },
				],
				default: ['message', 'reaction'],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Download Attachments',
						name: 'downloadAttachments',
						type: 'boolean',
						default: false,
						description: 'Whether to download the file attached to a message into the binary field "data"',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const wanted = this.getNodeParameter('updates', ['message', 'reaction']) as string[];
		const download = this.getNodeParameter('options.downloadAttachments', false) as boolean;
		const controller = new AbortController();
		let running = true;
		let offset = 0;

		const toItem = async (update: IDataObject): Promise<INodeExecutionData> => {
			const media = update.media as IDataObject | undefined;
			if (!download || !media?.mxc) return { json: update };
			const response = (await rempartRequest.call(
				this,
				'GET',
				`/v1/getFile?mxc=${encodeURIComponent(String(media.mxc))}`,
				undefined,
				{ encoding: 'arraybuffer', json: false, returnFullResponse: true },
			)) as { body: ArrayBuffer; headers: IDataObject };
			const binary: IBinaryKeyData = {
				data: await this.helpers.prepareBinaryData(
					Buffer.from(response.body),
					String(media.nom ?? 'file'),
					String(response.headers['content-type'] ?? ''),
				),
			};
			return { json: update, binary };
		};

		const getUpdates = async (timeout: number) =>
			((await rempartRequest.call(this, 'POST', '/v1/getUpdates', { offset, timeout }, {
				timeout: (timeout + 10) * 1000,
				abortSignal: controller.signal,
			})) as IDataObject).updates as IDataObject[] | undefined;

		// Polls until stopped; with `once`, returns after the first emitted batch.
		const poll = async (once: boolean): Promise<void> => {
			let attempt = 0;
			while (running) {
				try {
					const updates = (await getUpdates(25)) ?? [];
					attempt = 0;
					if (!updates.length) continue;
					offset = nextOffset(updates, offset);
					const kept = filterUpdates(updates, wanted);
					if (!kept.length) continue;
					this.emit([await Promise.all(kept.map(toItem))]);
					if (once) {
						// Acknowledge now: otherwise the test message would start the
						// workflow again once it is activated.
						await getUpdates(0);
						return;
					}
				} catch (error) {
					if (!running) return;
					const status = statusOf(error);
					if (status === 401 || status === 409) {
						this.emitError(error as Error);
						return;
					}
					await sleep(retryDelay(attempt++));
				}
			}
		};

		const closeFunction = async () => {
			running = false;
			controller.abort();
		};
		if (this.getMode() === 'manual') {
			return { closeFunction, manualTriggerFunction: async () => await poll(true) };
		}
		void poll(false);
		return { closeFunction };
	}
}
