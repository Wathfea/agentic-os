export type BriefingConnectionStatus = 'disconnected' | 'connected' | 'expired'

export type BriefingPipelineStatus =
  | 'disconnected'
  | 'ready'
  | 'fetch_failed'
  | 'summarization_failed'
  | 'stale'

export type BriefingActionItemStatus = 'open' | 'done' | 'dismissed'

export type BriefingActionItemSourceType = 'gmail_thread' | 'calendar_event'

export class BriefingEmailThreadDto {
  constructor(
    public readonly id: string,
    public readonly subject: string,
    public readonly from: string,
    public readonly receivedAt: string | null,
    public readonly snippet: string,
    public readonly unread: boolean,
  ) {}

  toJSON() {
    return {
      id: this.id,
      subject: this.subject,
      from: this.from,
      receivedAt: this.receivedAt,
      snippet: this.snippet,
      unread: this.unread,
    }
  }
}

export class BriefingCalendarEventDto {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly startAt: string | null,
    public readonly endAt: string | null,
    public readonly location: string | null,
    public readonly description: string | null,
    public readonly link: string | null,
  ) {}

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      startAt: this.startAt,
      endAt: this.endAt,
      location: this.location,
      description: this.description,
      link: this.link,
    }
  }
}

export class BriefingActionItemDto {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly sourceType: BriefingActionItemSourceType,
    public readonly sourceId: string,
    public readonly dueAt: string | null,
    public readonly priority: string | null,
    public readonly status: BriefingActionItemStatus,
  ) {}

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      dueAt: this.dueAt,
      priority: this.priority,
      status: this.status,
    }
  }
}

export class BriefingConnectionDto {
  constructor(
    public readonly status: BriefingConnectionStatus,
    public readonly email: string | null,
    public readonly connectedAt: string | null,
    public readonly googleConfigured: boolean,
  ) {}

  toJSON() {
    return {
      status: this.status,
      email: this.email,
      connectedAt: this.connectedAt,
      googleConfigured: this.googleConfigured,
    }
  }
}

export class BriefingStatusDto {
  constructor(
    public readonly status: BriefingPipelineStatus,
    public readonly lastUpdatedAt: string | null,
    public readonly statusMessage: string | null,
    public readonly summary: string[],
    public readonly refreshing: boolean,
  ) {}

  toJSON() {
    return {
      status: this.status,
      lastUpdatedAt: this.lastUpdatedAt,
      statusMessage: this.statusMessage,
      summary: this.summary,
      refreshing: this.refreshing,
    }
  }
}

export class BriefingOverviewDto {
  constructor(
    public readonly connection: BriefingConnectionDto,
    public readonly briefing: BriefingStatusDto,
    public readonly actionItems: BriefingActionItemDto[],
    public readonly stale: boolean,
    public readonly calendarEvents: BriefingCalendarEventDto[] = [],
  ) {}

  toJSON() {
    return {
      connection: this.connection.toJSON(),
      briefing: this.briefing.toJSON(),
      actionItems: this.actionItems.map((item) => item.toJSON()),
      stale: this.stale,
      calendarEvents: this.calendarEvents.map((item) => item.toJSON()),
    }
  }
}

export class BriefingConnectDto {
  constructor(public readonly authUrl: string) {}

  toJSON() {
    return {
      authUrl: this.authUrl,
    }
  }
}

export type BriefingGeneratedActionItem = {
  title: string
  sourceType: BriefingActionItemSourceType
  sourceId: string
  dueAt?: string | null
  priority?: string | null
}

export type BriefingGeneratedPayload = {
  summary: string[]
  actionItems: BriefingGeneratedActionItem[]
}
