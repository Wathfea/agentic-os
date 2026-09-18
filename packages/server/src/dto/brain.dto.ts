import type { BrainGraphLayer } from '../services/brain-graph-service.js'

export class BrainGraphNodeDto {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly layer: BrainGraphLayer,
    public readonly path: string,
    public readonly bytes: number,
  ) {}

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      layer: this.layer,
      path: this.path,
      bytes: this.bytes,
    }
  }
}

export class BrainGraphEdgeDto {
  constructor(
    public readonly id: string,
    public readonly source: string,
    public readonly target: string,
  ) {}

  toJSON() {
    return { id: this.id, source: this.source, target: this.target }
  }
}

export class BrainGraphDto {
  constructor(
    public readonly nodes: BrainGraphNodeDto[],
    public readonly edges: BrainGraphEdgeDto[],
  ) {}

  toJSON() {
    return {
      nodes: this.nodes.map((node) => node.toJSON()),
      edges: this.edges.map((edge) => edge.toJSON()),
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length,
    }
  }
}

export class BrainPageDto {
  constructor(
    public readonly path: string,
    public readonly title: string,
    public readonly layer: BrainGraphLayer,
    public readonly body: string,
    public readonly bytes: number,
  ) {}

  toJSON() {
    return {
      path: this.path,
      title: this.title,
      layer: this.layer,
      body: this.body,
      bytes: this.bytes,
    }
  }
}

export class BrainStatusDto {
  constructor(
    public readonly vaultPath: string,
    public readonly exists: boolean,
    public readonly rawSources: number,
    public readonly wikiPages: number,
    public readonly sourcePages: number,
    public readonly entityPages: number,
    public readonly conceptPages: number,
    public readonly orphanPages: number,
    public readonly mirroredProjects: number,
    public readonly lastIngest: string | null,
    public readonly lastLint: string | null,
  ) {}

  toJSON() {
    return {
      vaultPath: this.vaultPath,
      exists: this.exists,
      rawSources: this.rawSources,
      wikiPages: this.wikiPages,
      sourcePages: this.sourcePages,
      entityPages: this.entityPages,
      conceptPages: this.conceptPages,
      orphanPages: this.orphanPages,
      mirroredProjects: this.mirroredProjects,
      lastIngest: this.lastIngest,
      lastLint: this.lastLint,
    }
  }
}

export class BrainIngestRequestDto {
  constructor(
    public readonly url?: string,
    public readonly path?: string,
    public readonly note?: string,
  ) {}

  static fromBody(body: Record<string, unknown>): BrainIngestRequestDto {
    return new BrainIngestRequestDto(
      typeof body.url === 'string' ? body.url.trim() : undefined,
      typeof body.path === 'string' ? body.path.trim() : undefined,
      typeof body.note === 'string' ? body.note : undefined,
    )
  }
}

export class BrainQueryRequestDto {
  constructor(public readonly question: string) {}

  static fromBody(body: Record<string, unknown>): BrainQueryRequestDto {
    return new BrainQueryRequestDto(typeof body.question === 'string' ? body.question.trim() : '')
  }
}

export class BrainQueryResultDto {
  constructor(
    public readonly question: string,
    public readonly answer: string,
  ) {}

  toJSON() {
    return { question: this.question, answer: this.answer }
  }
}

export class BrainMirrorResultDto {
  constructor(
    public readonly mirrored: number,
    public readonly log: string,
  ) {}

  toJSON() {
    return { mirrored: this.mirrored, log: this.log }
  }
}

export class BrainScaffoldResultDto {
  constructor(
    public readonly scaffolded: number,
    public readonly log: string,
  ) {}

  toJSON() {
    return { scaffolded: this.scaffolded, log: this.log }
  }
}
