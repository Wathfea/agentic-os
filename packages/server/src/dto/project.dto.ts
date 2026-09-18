export type GraphStatus = 'pending' | 'building' | 'ready' | 'error' | 'stale'
export type ProjectSourceType = 'local' | 'github'

export class ProjectDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly path: string,
    public readonly alias: string,
    public readonly graphStatus: GraphStatus,
    public readonly graphNodeCount: number,
    public readonly lastBuiltAt: string | null,
    public readonly hooksInstalled: boolean,
    public readonly autoRebuild: boolean,
    public readonly rebuildIntervalHours: number | null,
    public readonly lastScheduledAt: string | null,
    public readonly totalTokensSaved: number,
    public readonly totalTokensUsed: number,
    public readonly totalCostSavedUsd: number,
    public readonly totalCostUsedUsd: number,
    public readonly sourceType: ProjectSourceType,
    public readonly githubUrl: string | null,
    public readonly githubBranch: string | null,
    public readonly createdAt: string,
  ) {}

  static fromRow(row: Record<string, unknown>): ProjectDto {
    return new ProjectDto(
      String(row.id),
      String(row.name),
      String(row.path),
      String(row.alias),
      String(row.graph_status) as GraphStatus,
      Number(row.graph_node_count ?? 0),
      row.last_built_at ? String(row.last_built_at) : null,
      Boolean(row.hooks_installed),
      Boolean(row.auto_rebuild),
      row.rebuild_interval_hours == null ? null : Number(row.rebuild_interval_hours),
      row.last_scheduled_at ? String(row.last_scheduled_at) : null,
      Number(row.total_tokens_saved ?? 0),
      Number(row.total_tokens_used ?? 0),
      Number(row.total_cost_saved_usd ?? 0),
      Number(row.total_cost_used_usd ?? 0),
      (String(row.source_type ?? 'local') as ProjectSourceType),
      row.github_url ? String(row.github_url) : null,
      row.github_branch ? String(row.github_branch) : null,
      String(row.created_at),
    )
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      path: this.path,
      alias: this.alias,
      graphStatus: this.graphStatus,
      graphNodeCount: this.graphNodeCount,
      lastBuiltAt: this.lastBuiltAt,
      hooksInstalled: this.hooksInstalled,
      autoRebuild: this.autoRebuild,
      rebuildIntervalHours: this.rebuildIntervalHours,
      lastScheduledAt: this.lastScheduledAt,
      totalTokensSaved: this.totalTokensSaved,
      totalTokensUsed: this.totalTokensUsed,
      totalCostSavedUsd: this.totalCostSavedUsd,
      totalCostUsedUsd: this.totalCostUsedUsd,
      sourceType: this.sourceType,
      githubUrl: this.githubUrl,
      githubBranch: this.githubBranch,
      createdAt: this.createdAt,
    }
  }
}

export class CodeCandidateDto {
  constructor(
    public readonly name: string,
    public readonly path: string,
    public readonly isGit: boolean,
    public readonly hasPackageJson: boolean,
    public readonly hasPyproject: boolean,
    public readonly registered: boolean,
  ) {}

  toJSON() {
    return {
      name: this.name,
      path: this.path,
      isGit: this.isGit,
      hasPackageJson: this.hasPackageJson,
      hasPyproject: this.hasPyproject,
      registered: this.registered,
    }
  }
}

export class CloneProjectRequestDto {
  constructor(
    public readonly url: string,
    public readonly name?: string,
    public readonly alias?: string,
    public readonly branch?: string,
  ) {}
}
