import { ensureGraphifyOutIgnored } from '../services/graphify-hooks.js'

const projectPath = process.argv[2]
if (!projectPath) process.exit(0)
ensureGraphifyOutIgnored(projectPath)
