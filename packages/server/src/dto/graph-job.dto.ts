export type JobKind = 'full' | 'update' | 'hooks_only'
export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

export class GraphJobDto {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly kind: JobKind,
    public readonly status: JobStatus,
    public readonly logTail: string,
    public readonly startedAt: string | null,
    public readonly finishedAt: string | null,
    public readonly errorMessage: string | null,
    public readonly llmUsed: boolean,
    public readonly tokensUsed: number,
    public readonly tokensSaved: number,
    public readonly costUsd: number,
    public readonly costSavedUsd: number,
  ) {}

  static fromRow(row: Record<string, unknown>): GraphJobDto {
    return new GraphJobDto(
      String(row.id),
      String(row.project_id),
      String(row.kind) as JobKind,
      String(row.status) as JobStatus,
      String(row.log_tail ?? ''),
      row.started_at ? String(row.started_at) : null,
      row.finished_at ? String(row.finished_at) : null,
      row.error_message ? String(row.error_message) : null,
      Boolean(row.llm_used),
      Number(row.tokens_used ?? 0),
      Number(row.tokens_saved ?? 0),
      Number(row.cost_usd ?? 0),
      Number(row.cost_saved_usd ?? 0),
    )
  }

  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      kind: this.kind,
      status: this.status,
      logTail: this.logTail,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      errorMessage: this.errorMessage,
      llmUsed: this.llmUsed,
      tokensUsed: this.tokensUsed,
      tokensSaved: this.tokensSaved,
      costUsd: this.costUsd,
      costSavedUsd: this.costSavedUsd,
    }
  }
}

export class GraphDataDto {
  constructor(
    public readonly nodes: Array<{ id: string; label: string; type?: string }>,
    public readonly edges: Array<{ id: string; source: string; target: string; label?: string }>,
    public readonly nodeCount: number,
    public readonly edgeCount: number,
  ) {}

  toJSON() {
    return {
      nodes: this.nodes,
      edges: this.edges,
      nodeCount: this.nodeCount,
      edgeCount: this.edgeCount,
    }
  }
}
