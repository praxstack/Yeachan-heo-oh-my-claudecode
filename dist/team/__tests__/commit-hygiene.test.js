import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTeamCommitHygieneContext, renderTeamCommitHygieneMarkdown, resolveTeamCommitHygieneArtifactCwd, resolveTeamCommitHygieneArtifactPaths, TEAM_OPERATIONAL_COMMIT_KINDS, TEAM_OPERATIONAL_COMMIT_STATUSES, writeTeamCommitHygieneContext, } from '../commit-hygiene.js';
describe('team commit hygiene vocabulary', () => {
    it('includes canonical operation and status vocabulary in structured context', () => {
        const tasks = [
            {
                id: '1',
                subject: 'worker result',
                description: 'preserve worker output',
                status: 'completed',
                role: 'executor',
                owner: 'worker-1',
                version: 1,
                created_at: '2026-04-26T00:00:00.000Z',
            },
        ];
        const ledger = {
            version: 1,
            team_name: 'team-hygiene',
            updated_at: '2026-04-26T00:00:00.000Z',
            runtime_commits_are_scaffolding: true,
            entries: [
                {
                    recorded_at: '2026-04-26T00:00:00.000Z',
                    operation: 'auto_checkpoint',
                    worker_name: 'worker-1',
                    task_id: '1',
                    status: 'applied',
                    operational_commit: 'abc1234',
                },
            ],
        };
        const context = buildTeamCommitHygieneContext({
            teamName: 'team-hygiene',
            tasks,
            ledger,
        });
        expect(context.vocabulary.operational_commit_kinds.map((term) => term.value))
            .toEqual([...TEAM_OPERATIONAL_COMMIT_KINDS]);
        expect(context.vocabulary.operational_commit_statuses.map((term) => term.value))
            .toEqual([...TEAM_OPERATIONAL_COMMIT_STATUSES]);
        expect(context.vocabulary.operational_commit_kinds.find((term) => term.value === 'auto_checkpoint')?.description ?? '')
            .toMatch(/worker-local checkpoint commit/i);
        expect(context.vocabulary.operational_commit_statuses.find((term) => term.value === 'conflict')?.description ?? '')
            .toMatch(/reconciliation/i);
    });
    it('renders the vocabulary before runtime ledger details in markdown', () => {
        const context = buildTeamCommitHygieneContext({
            teamName: 'team-hygiene',
            tasks: [],
            ledger: {
                version: 1,
                team_name: 'team-hygiene',
                updated_at: '2026-04-26T00:00:00.000Z',
                runtime_commits_are_scaffolding: true,
                entries: [],
            },
        });
        const markdown = renderTeamCommitHygieneMarkdown(context);
        expect(markdown).toMatch(/## Commit Hygiene Vocabulary/);
        expect(markdown).toMatch(/### Operational commit kinds/);
        expect(markdown).toMatch(/`integration_cherry_pick` \(integration cherry-pick\)/);
        expect(markdown).toMatch(/### Operational commit statuses/);
        expect(markdown).toMatch(/`noop` \(no-op\)/);
        expect(markdown.indexOf('## Commit Hygiene Vocabulary'))
            .toBeLessThan(markdown.indexOf('## Runtime Operational Ledger'));
    });
});
describe('team commit hygiene artifact root', () => {
    it('derives leader-facing artifacts from persisted team metadata instead of worker cwd', () => {
        const leaderCwd = '/tmp/omc-leader';
        const workerCwd = `${leaderCwd}/.omc/team/demo/worktrees/worker-3`;
        expect(resolveTeamCommitHygieneArtifactCwd({
            workers: [],
            leader_cwd: leaderCwd,
            team_state_root: `${leaderCwd}/.omc/state`,
        }, workerCwd)).toBe(leaderCwd);
        expect(resolveTeamCommitHygieneArtifactCwd({
            workers: [
                {
                    name: 'worker-3',
                    index: 3,
                    role: 'executor',
                    assigned_tasks: ['3'],
                    worktree_repo_root: leaderCwd,
                    worktree_path: workerCwd,
                },
            ],
            team_state_root: `${leaderCwd}/.omc/state`,
        }, workerCwd)).toBe(leaderCwd);
        expect(resolveTeamCommitHygieneArtifactCwd({
            workers: [],
            team_state_root: `${leaderCwd}/.omc/state`,
        }, workerCwd)).toBe(leaderCwd);
    });
    it('resolves and writes leader-facing artifacts under .omc reports without .omx leakage', async () => {
        const repo = mkdtempSync(join(tmpdir(), 'omc-commit-hygiene-'));
        const teamName = 'team-hygiene';
        try {
            const paths = resolveTeamCommitHygieneArtifactPaths(teamName, repo);
            expect(paths.jsonPath).toBe(join(repo, '.omc', 'reports', 'team-commit-hygiene', `${teamName}.context.json`));
            expect(paths.markdownPath).toBe(join(repo, '.omc', 'reports', 'team-commit-hygiene', `${teamName}.md`));
            expect(JSON.stringify(paths)).not.toContain('.omx/');
            const written = await writeTeamCommitHygieneContext(teamName, buildTeamCommitHygieneContext({
                teamName,
                tasks: [],
                ledger: {
                    version: 1,
                    team_name: teamName,
                    updated_at: '2026-04-26T00:00:00.000Z',
                    runtime_commits_are_scaffolding: true,
                    entries: [],
                },
            }), repo);
            expect(written).toEqual(paths);
            expect(existsSync(paths.jsonPath)).toBe(true);
            expect(existsSync(paths.markdownPath)).toBe(true);
            expect(existsSync(join(repo, '.omx', 'reports', 'team-commit-hygiene', `${teamName}.context.json`))).toBe(false);
            expect(readFileSync(paths.markdownPath, 'utf-8')).not.toContain('.omx/');
        }
        finally {
            rmSync(repo, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=commit-hygiene.test.js.map