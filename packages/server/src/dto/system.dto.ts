export class SystemHealthDto {
  constructor(
    public readonly graphifyVersion: string | null,
    public readonly graphifyPath: string | null,
    public readonly graphifyPathBare: string | null,
    public readonly globalGraphPath: string,
    public readonly codeRoot: string,
    public readonly agenticRoot: string,
    public readonly projectCount: number,
    public readonly skillCount: number,
  ) {}

  toJSON() {
    return {
      graphifyVersion: this.graphifyVersion,
      graphifyPath: this.graphifyPath,
      graphifyPathBare: this.graphifyPathBare,
      globalGraphPath: this.globalGraphPath,
      codeRoot: this.codeRoot,
      agenticRoot: this.agenticRoot,
      projectCount: this.projectCount,
      skillCount: this.skillCount,
    }
  }
}

export class GraphQueryResultDto {
  constructor(
    public readonly question: string,
    public readonly scope: string,
    public readonly output: string,
  ) {}

  toJSON() {
    return {
      question: this.question,
      scope: this.scope,
      output: this.output,
    }
  }
}

export class GlobalGraphEntryDto {
  constructor(
    public readonly alias: string,
    public readonly nodeCount: number,
    public readonly edgeCount: number,
  ) {}

  toJSON() {
    return {
      alias: this.alias,
      nodeCount: this.nodeCount,
      edgeCount: this.edgeCount,
    }
  }
}

export class LoopHealthProjectDto {
  constructor(
    public readonly projectId: string,
    public readonly name: string,
    public readonly alias: string,
    public readonly graphStatus: string,
    public readonly nodeCount: number,
    public readonly graphAgeHours: number | null,
    public readonly graphStale: boolean,
    public readonly graphWikiPresent: boolean,
    public readonly devWikiSeeded: boolean,
    public readonly gotchasEmpty: boolean,
    public readonly autoRebuild: boolean,
    public readonly graphifyGitignoreOk: boolean,
  ) {}

  toJSON() {
    return {
      projectId: this.projectId,
      name: this.name,
      alias: this.alias,
      graphStatus: this.graphStatus,
      nodeCount: this.nodeCount,
      graphAgeHours: this.graphAgeHours,
      graphStale: this.graphStale,
      graphWikiPresent: this.graphWikiPresent,
      devWikiSeeded: this.devWikiSeeded,
      gotchasEmpty: this.gotchasEmpty,
      autoRebuild: this.autoRebuild,
      graphifyGitignoreOk: this.graphifyGitignoreOk,
    }
  }
}

export class LoopHealthSummaryDto {
  constructor(
    public readonly projectCount: number,
    public readonly staleGraphCount: number,
    public readonly emptyGotchasCount: number,
    public readonly missingWikiCount: number,
    public readonly brainLintAgeHours: number | null,
  ) {}

  toJSON() {
    return {
      projectCount: this.projectCount,
      staleGraphCount: this.staleGraphCount,
      emptyGotchasCount: this.emptyGotchasCount,
      missingWikiCount: this.missingWikiCount,
      brainLintAgeHours: this.brainLintAgeHours,
    }
  }
}

export class LoopHealthDto {
  constructor(
    public readonly summary: LoopHealthSummaryDto,
    public readonly projects: LoopHealthProjectDto[],
  ) {}

  toJSON() {
    return {
      summary: this.summary.toJSON(),
      projects: this.projects.map((p) => p.toJSON()),
    }
  }
}
