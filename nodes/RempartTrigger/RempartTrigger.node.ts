import type {
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';
import { downloadFile, rempartRequest } from '../Rempart/GenericFunctions';
import { downloadErrorItem, filterUpdates, manualAck, nextOffset, retryDelay, statusOf } from '../Rempart/helpers';

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
		// Nothing selected would acknowledge, and so drop, every update the bot receives.
		if (!wanted.length) {
			throw new NodeOperationError(this.getNode(), 'Select at least one update type in Trigger On');
		}
		const download = this.getNodeParameter('options.downloadAttachments', false) as boolean;
		const controller = new AbortController();
		let running = true;
		let offset = 0;

		// A failed download must not lose the message: it is emitted without the
		// binary data, the error recorded in `download_error`, instead of letting
		// the whole batch's offset advance past a message nothing ever saw.
		const toItem = async (update: IDataObject): Promise<INodeExecutionData> => {
			const media = update.media as IDataObject | undefined;
			if (!download || !media?.mxc) return { json: update };
			try {
				const binary: IBinaryKeyData = {
					data: await downloadFile.call(this, String(media.mxc), String(media.nom || '')),
				};
				return { json: update, binary };
			} catch (error) {
				return { json: downloadErrorItem(update, error) };
			}
		};

		const getUpdates = async (timeout: number) =>
			((await rempartRequest.call(this, 'POST', '/v1/getUpdates', { offset, timeout }, {
				timeout: (timeout + 10) * 1000,
				abortSignal: controller.signal,
			})) as IDataObject).updates as IDataObject[] | undefined;

		// Polls until stopped; with `once`, returns after the first emitted update. Each
		// kept update starts its own execution, in order: never a batch in one emit.
		const poll = async (once: boolean): Promise<void> => {
			let attempt = 0;
			while (running) {
				try {
					const updates = (await getUpdates(25)) ?? [];
					attempt = 0;
					if (!updates.length) continue;
					const kept = filterUpdates(updates, wanted);
					if (!kept.length) {
						offset = nextOffset(updates, offset);
						continue;
					}
					if (once) {
						const ack = manualAck(kept);
						this.emit([[await toItem(ack.item)]]);
						// Acknowledge only up to the emitted update: the gateway purges
						// everything below the offset, so the rest of the batch stays
						// pending instead of being lost once the workflow activates.
						offset = ack.offset;
						// Stop first: a failed acknowledgement must not keep the test polling,
						// it would start on, and consume, the next message.
						running = false;
						await getUpdates(0);
						return;
					}
					offset = nextOffset(updates, offset);
					for (const update of kept) {
						// Stopped mid-batch: what was not emitted is not acknowledged either,
						// so it comes back on the next activation.
						if (!running) return;
						this.emit([[await toItem(update)]]);
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
