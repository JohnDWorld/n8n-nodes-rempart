# n8n-nodes-rempart

n8n community nodes for [Rempart Messenger](https://rempart-messenger.fr), an end-to-end encrypted messenger hosted in France, built on the Matrix protocol.

Your workflows talk to people through a Rempart bot, the way the Telegram nodes do with a Telegram bot:

- **Rempart Trigger** starts a workflow when your bot receives a message or a reaction.
- **Rempart** sends messages (with buttons), photos and documents, edits or deletes them, shows "typing", downloads received files, and can **Send and Wait for Response**: the workflow pauses until someone answers.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Usage](#usage) · [Limits](#limits) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

In n8n, open **Settings > Community Nodes > Install**, enter `n8n-nodes-rempart` and confirm. See the n8n guide on [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

The nodes act as a bot that belongs to your Rempart account.

1. In the Rempart app, open **Mes bots** (My bots), create a bot and copy its **API token**. It is shown only once; if you lose it, regenerate it from the bot's menu.
2. In n8n, create a **Rempart API** credential:
   - **Bot Token**: the token from step 1.
   - **Gateway URL**: leave the default, `https://gateway.rempart-messenger.fr`.

n8n checks the credential by asking the gateway who the bot is.

## Operations

**Rempart Trigger**

- **Trigger On**: messages, reactions, or both.
- **Download Attachments**: photos, videos and files sent to the bot arrive as binary data. If a download fails, the update still arrives, with a `download_error` field.

Each update starts its own execution and carries `room_id`, `message_id`, `sender`, `sender_name`, `text` and `date`, plus `media`, `reaction`, `command` and `args` when relevant. In a group, the bot only receives the messages that mention it, and `context` holds the recent messages so an AI agent can follow the conversation.

**Rempart**

| Resource | Operations |
|---|---|
| Message | Send (with up to 8 buttons), Send and Wait for Response, Edit Text, Delete, Send Photo, Send Document |
| Chat | Send Typing |
| File | Download |
| Bot | Get Info |

`Room ID` defaults to `{{ $json.room_id }}`, so a node placed after the trigger answers in the conversation the message came from. Rempart can also be used as a tool by an AI agent.

## Usage

**Echo bot.** Rempart Trigger, then Rempart > Message > Send with `Text` set to `{{ $json.text }}`. Set `Options > Reply To Message ID` to `{{ $json.message_id }}` to quote the message.

**AI assistant.** Rempart Trigger, then an AI Agent whose prompt is `{{ $json.text }}`, then Rempart > Message > Send with the agent's output. Add Chat > Send Typing before the agent so the person sees the bot is working.

**Approval before an action.** Rempart > Message > Send and Wait for Response, with `Response Type` set to `Approval`. The person sees two buttons. The execution resumes when they tap one, and the node outputs:

```json
{
  "question_id": "$question",
  "room_id": "!room:rempart-messenger.fr",
  "message_id": "$answer",
  "sender": "@u_...:rempart-messenger.fr",
  "sender_name": "Camille",
  "value": "approve",
  "label": "✅ Approve",
  "approved": true
}
```

Follow it with an IF node on `{{ $json.approved }}`. In a group anyone can answer: check `sender` if only one person may approve. `Choices` offers up to 8 buttons of your own and outputs the chosen `value`. `Free Text` waits for the next message (in a group, a reply that quotes the question) and outputs its `text`.

With **Limit Wait Time**, the execution resumes after the delay even without an answer. The node then outputs its input items unchanged: an answer always carries `question_id`, so `{{ $json.question_id }}` tells the two cases apart.

Buttons are a Rempart feature. Other Matrix apps (Element...) do not show them, so keep the question understandable as text: there, people answer by typing the value (`approve`, `decline`, or your own values).

## Limits

- **One active workflow per bot.** Each Rempart Trigger takes the updates it reads: two workflows polling the same bot would split its messages. Use one bot per workflow. A bot with a webhook set (Bot API `setWebhook`) cannot be polled: the trigger stops with an explicit error.
- **A rare duplicate after a restart.** If n8n stops right after receiving an update and before acknowledging it, that update comes back once.
- **Send and Wait needs an n8n the gateway can reach.** The answer resumes the workflow through n8n's resume URL, built from n8n's `WEBHOOK_URL` setting. An n8n without it, or only reachable from your own network, gets a clear error when the question is sent: set `WEBHOOK_URL` to n8n's public address.
- **Bots do not hold encryption keys.** Rempart creates one-to-one chats with a bot unencrypted, and says so in the conversation; messages sent to a bot are readable by the server. In an encrypted group (every Rempart group is), the bot cannot read messages.

## Compatibility

Tested with n8n 2.28, self-hosted. On n8n Cloud, community nodes are available once verified by n8n.

## Resources

- [Rempart bot API](https://rempart-messenger.fr/api-bots.md) (in French): the HTTP API these nodes use, also usable directly or through MCP.
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Version history

- **0.1.0**: first release. Rempart Trigger (messages, reactions, attachments) and Rempart (messages with buttons, Send and Wait for Response, photos, documents, typing, file download, bot info).

## License

[MIT](LICENSE)
