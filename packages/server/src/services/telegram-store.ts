import { getDb } from '../db/index.js'

export type TelegramConnectionRow = {
  bot_token: string
  chat_id: string
  connected_at: string
  updated_at: string
}

export function getTelegramConnection(): TelegramConnectionRow | null {
  const row = getDb()
    .prepare(
      `SELECT bot_token, chat_id, connected_at, updated_at
       FROM telegram_connection WHERE id = 1`,
    )
    .get() as TelegramConnectionRow | undefined
  return row ?? null
}

export function saveTelegramConnection(botToken: string, chatId: string): void {
  getDb()
    .prepare(
      `INSERT INTO telegram_connection (id, bot_token, chat_id, connected_at, updated_at)
       VALUES (1, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         bot_token = excluded.bot_token,
         chat_id = excluded.chat_id,
         updated_at = datetime('now')`,
    )
    .run(botToken, chatId)
}

export function clearTelegramConnection(): void {
  getDb().prepare('DELETE FROM telegram_connection WHERE id = 1').run()
}
