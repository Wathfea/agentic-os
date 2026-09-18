import { formatForTelegram, plainTextForTelegram, splitMessage } from './telegram-format.js'

async function telegramHttpPost(token: string, method: string, body: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return res.ok
}

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const rawParts = splitMessage(text)
  for (const rawPart of rawParts) {
    const formatted = formatForTelegram(rawPart)
    const htmlOk = await telegramHttpPost(
      token,
      'sendMessage',
      JSON.stringify({
        chat_id: chatId,
        text: formatted,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    )
    if (htmlOk) continue

    const plain = plainTextForTelegram(rawPart)
    const plainOk = await telegramHttpPost(
      token,
      'sendMessage',
      JSON.stringify({
        chat_id: chatId,
        text: plain,
        disable_web_page_preview: true,
      }),
    )
    if (!plainOk) {
      throw new Error('Telegram sendMessage failed')
    }
  }
}
