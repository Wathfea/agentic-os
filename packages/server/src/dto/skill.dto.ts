export type SkillSource = 'seed' | 'global' | 'project'

export class SkillDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly source: SkillSource,
    public readonly path: string,
    public readonly description: string,
    public readonly projectName: string | null,
    public readonly writable: boolean,
  ) {}

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      path: this.path,
      description: this.description,
      projectName: this.projectName,
      writable: this.writable,
    }
  }
}
