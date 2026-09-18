import { closeDb } from '../db/index.js'
import { getTelegramConnection, saveTelegramConnection } from '../services/telegram-store.js'

const HOWTO = `Telegram connection is outbound only. Morning mix is pushed to your chat; Agentic OS does not read replies.

  1. Open @BotFather in Telegram and send /newbot. Copy the HTTP API token.
  2. Open the new bot and tap Start.
  3. Send it any message, then open:
     https://api.telegram.org/bot<token>/getUpdates
     Copy chat.id from the JSON.
  4. Save the token and chat id here, or later in the dashboard Routines panel.
  5. Start Agentic OS and click Test in Routines. You should get a short confirmation in that chat.
`

function usage(): never {
  console.error('usage: telegram-setup howto|status|save [botToken chatId]')
  process.exit(1)
}

const cmd = process.argv[2]
if (cmd === 'howto') {
  process.stdout.write(HOWTO)
  process.exit(0)
}

if (cmd === 'status') {
  const row = getTelegramConnection()
  closeDb()
  if (!row) {
    console.log('disconnected')
  } else {
    console.log(`connected ${row.chat_id}`)
  }
  process.exit(0)
}

if (cmd === 'save') {
  const botToken = (process.argv[3] ?? process.env.AGENTIC_TELEGRAM_BOT_TOKEN ?? '').trim()
  const chatId = (process.argv[4] ?? process.env.AGENTIC_TELEGRAM_CHAT_ID ?? '').trim()
  if (!botToken || !chatId) {
    console.error('botToken and chatId are required')
    closeDb()
    process.exit(1)
  }
  saveTelegramConnection(botToken, chatId)
  closeDb()
  console.log(`connected ${chatId}`)
  process.exit(0)
}

usage()
