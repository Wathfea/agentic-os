import { Hono } from 'hono'
import {
  createSkill,
  deleteSeedSkill,
  getSkillById,
  listSkills,
  readSkillContent,
  syncSeedToGlobal,
  writeSkillContent,
} from '../services/skills-manager.js'

export const skillsRoutes = new Hono()

skillsRoutes.get('/skills', (c) => {
  const skills = listSkills().map((s) => s.toJSON())
  return c.json({ skills })
})

skillsRoutes.get('/skills/:id', (c) => {
  const skill = getSkillById(c.req.param('id'))
  if (!skill) return c.json({ error: 'Not found' }, 404)
  try {
    const content = readSkillContent(skill.id)
    return c.json({ skill: skill.toJSON(), content })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

skillsRoutes.put('/skills/:id', async (c) => {
  const body = await c.req.json<{ content: string }>()
  try {
    writeSkillContent(c.req.param('id'), body.content)
    const skill = getSkillById(c.req.param('id'))
    return c.json({ skill: skill?.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

skillsRoutes.post('/skills', async (c) => {
  const body = await c.req.json<{ name: string; description: string; body?: string }>()
  try {
    const skill = createSkill(body.name, body.description, body.body ?? '')
    return c.json({ skill: skill.toJSON() })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

skillsRoutes.delete('/skills/:id', (c) => {
  try {
    deleteSeedSkill(c.req.param('id'))
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error' }, 400)
  }
})

skillsRoutes.post('/skills/sync', (c) => {
  const count = syncSeedToGlobal()
  return c.json({ synced: count })
})
