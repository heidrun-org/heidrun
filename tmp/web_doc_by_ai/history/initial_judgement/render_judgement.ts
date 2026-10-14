import Fs from 'node:fs';
import { DocumentationJudge } from '/Users/jetienne/webwork/heidrun/.claude/worktrees/generate-docs-with-ai-375/packages/dev_tools/documentation_updater/src/index.ts';

const judgement = JSON.parse(Fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(`${DocumentationJudge.renderReport(judgement)}\n`);
