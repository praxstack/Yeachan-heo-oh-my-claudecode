import { describe, expect, it } from 'vitest';
import { readTeamPaneStatus } from '../pane-status.js';

function expectNoLegacyOmxPathLeakage(value: unknown): void {
  expect(JSON.stringify(value)).not.toContain('.omx/');
}

describe('pane-status OMX parity adapter', () => {
  it('returns empty inspect metadata without config', async () => {
    const status = await readTeamPaneStatus(null, '/tmp/demo');
    expect(status.leader_pane_id).toBeNull();
    expect(status.recommended_inspect_targets).toEqual([]);
  });

  it('builds sparkshell commands and dead-worker inspect items', async () => {
    const status = await readTeamPaneStatus({
      name: 'demo',
      task: 'demo',
      agent_type: 'executor',
      worker_launch_mode: 'prompt',
      worker_count: 1,
      max_workers: 1,
      created_at: '2026-05-02T00:00:00.000Z',
      tmux_session: 'demo',
      next_task_id: 1,
      leader_pane_id: '%1',
      hud_pane_id: null,
      resize_hook_name: null,
      resize_hook_target: null,
      workers: [{
        name: 'worker-1',
        index: 1,
        role: 'executor',
        worker_cli: 'codex',
        assigned_tasks: ['1'],
        pane_id: '%2',
      }],
    }, '/tmp/demo', {
      teamName: 'demo',
      deadWorkers: ['worker-1'],
      nonReportingWorkers: [],
      workers: [{ name: 'worker-1', alive: false, status: { state: 'unknown', updated_at: '2026-05-02T00:00:00.000Z' } }],
      tasks: { items: [{ id: '1', subject: 'Task 1', description: 'Do it', status: 'pending', created_at: '2026-05-02T00:00:00.000Z' }] },
    });

    expect(status.worker_panes['worker-1']).toBe('%2');
    expect(status.sparkshell_commands['worker-1']).toContain('omx sparkshell --tmux-pane %2');
    expect(status.recommended_inspect_targets).toEqual(['worker-1']);
    expect(status.recommended_inspect_reasons['worker-1']).toBe('dead_worker');
    expect(status.recommended_inspect_items[0]?.worker_cli).toBe('codex');
  });

  it('reports OMC-rooted inspect paths without legacy .omx path leakage', async () => {
    const status = await readTeamPaneStatus({
      name: 'demo',
      task: 'demo',
      agent_type: 'executor',
      worker_launch_mode: 'prompt',
      worker_count: 1,
      max_workers: 1,
      created_at: '2026-05-02T00:00:00.000Z',
      tmux_session: 'demo',
      next_task_id: 2,
      leader_pane_id: '%1',
      hud_pane_id: null,
      resize_hook_name: null,
      resize_hook_target: null,
      workers: [{
        name: 'worker-1',
        index: 1,
        role: 'executor',
        worker_cli: 'codex',
        assigned_tasks: ['1'],
        pane_id: '%2',
      }],
    }, '/tmp/demo', {
      teamName: 'demo',
      deadWorkers: ['worker-1'],
      nonReportingWorkers: [],
      workers: [{
        name: 'worker-1',
        alive: false,
        status: {
          state: 'working',
          current_task_id: '1',
          updated_at: '2026-05-02T00:00:00.000Z',
        },
      }],
      tasks: {
        items: [{
          id: '1',
          subject: 'Task 1',
          description: 'Do it',
          status: 'in_progress',
          owner: 'worker-1',
          created_at: '2026-05-02T00:00:00.000Z',
          claim: {
            owner: 'worker-1',
            token: 'token-1',
            leased_until: '2026-05-02T00:15:00.000Z',
          },
        }],
      },
    });

    expect(status.recommended_inspect_task_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/tasks/task-1.json');
    expect(status.recommended_inspect_approval_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/approvals/task-1.json');
    expect(status.recommended_inspect_worker_status_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/workers/worker-1/status.json');
    expect(status.recommended_inspect_worker_mailbox_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/mailbox/worker-1.json');
    expect(status.recommended_inspect_task_claim_lock_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/claims/task-1.lock');
    expect(status.recommended_inspect_worker_inbox_paths['worker-1'])
      .toBe('/tmp/demo/.omc/state/team/demo/workers/worker-1/inbox.md');
    expectNoLegacyOmxPathLeakage(status.recommended_inspect_items);
  });
});
