export class TelegramConnectionDto {
  constructor(
    public readonly connected: boolean,
    public readonly chatId: string | null,
  ) {}

  toJSON() {
    return {
      connected: this.connected,
      chatId: this.chatId,
    }
  }
}

export class MixStatusDto {
  constructor(
    public readonly cron: string,
    public readonly enabled: boolean,
    public readonly lastStatus: string,
    public readonly lastError: string | null,
    public readonly lastRunAt: string | null,
    public readonly nextRunAt: number | null,
    public readonly running: boolean,
  ) {}

  toJSON() {
    return {
      cron: this.cron,
      enabled: this.enabled,
      lastStatus: this.lastStatus,
      lastError: this.lastError,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      running: this.running,
    }
  }
}

export class MixSourceDto {
  constructor(
    public readonly id: string,
    public readonly channelId: string,
    public readonly title: string,
    public readonly handle: string | null,
    public readonly enabled: boolean,
  ) {}

  toJSON() {
    return {
      id: this.id,
      channelId: this.channelId,
      title: this.title,
      handle: this.handle,
      enabled: this.enabled,
    }
  }
}

export class MixOverviewDto {
  constructor(
    public readonly telegram: TelegramConnectionDto,
    public readonly mix: MixStatusDto,
    public readonly sources: MixSourceDto[],
  ) {}

  toJSON() {
    return {
      telegram: this.telegram.toJSON(),
      mix: this.mix.toJSON(),
      sources: this.sources.map((source) => source.toJSON()),
    }
  }
}
