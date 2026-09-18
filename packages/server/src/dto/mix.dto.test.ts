import { describe, expect, it } from 'bun:test'
import {
  MixOverviewDto,
  MixSourceDto,
  MixStatusDto,
  TelegramConnectionDto,
} from './mix.dto.js'

describe('MixOverviewDto', () => {
  it('serializes telegram, mix status, and sources without a bot token', () => {
    const dto = new MixOverviewDto(
      new TelegramConnectionDto(true, '12345'),
      new MixStatusDto('30 7 * * *', true, 'idle', null, null, 1780000000, false),
      [new MixSourceDto('src-1', 'UCabc', 'Some channel', '@some', true)],
    )
    const json = dto.toJSON()
    expect(json.telegram).toEqual({ connected: true, chatId: '12345' })
    expect(json.mix.cron).toBe('30 7 * * *')
    expect(json.sources[0]?.title).toBe('Some channel')
    expect(JSON.stringify(json)).not.toContain('bot')
  })
})
