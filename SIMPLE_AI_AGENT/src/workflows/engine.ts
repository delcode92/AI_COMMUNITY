import { Workflow, WorkflowRun, StepResult, AgentContext } from '../core/types';
import { SkillRouter } from '../core/skillRouter';
import { BrowserStorage } from '../storage';

export class WorkflowEngine {
  constructor(
    private router: SkillRouter,
    private storage: BrowserStorage
  ) {}

  async run(
    workflow: Workflow,
    ctx: AgentContext,
    onStepComplete?: (step: StepResult, run: WorkflowRun) => void
  ): Promise<WorkflowRun> {
    const run: WorkflowRun = {
      runId: crypto.randomUUID(),
      workflowId: workflow.id,
      status: 'running',
      steps: [],
      startedAt: Date.now(),
    };

    await this.storage.idb.saveRun(run);

    for (const step of workflow.steps) {
      if (step.condition && !step.condition(run.steps)) {
        console.info(`[WorkflowEngine] Skipping "${step.id}" (condition false)`);
        continue;
      }

      const input = typeof step.input === 'function' ? step.input(run.steps) : step.input;
      const t0 = performance.now();

      let stepResult: StepResult;
      try {
        const result = await this.router.call(step.toolName, input, ctx);
        stepResult = { stepId: step.id, toolName: step.toolName, result, durationMs: Math.round(performance.now() - t0) };
      } catch (err) {
        stepResult = {
          stepId: step.id,
          toolName: step.toolName,
          result: { success: false, error: (err as Error).message },
          durationMs: Math.round(performance.now() - t0),
        };
      }

      run.steps.push(stepResult);
      await this.storage.idb.saveRun(run); // checkpoint

      onStepComplete?.(stepResult, run);

      if (!stepResult.result.success) {
        run.status = 'failed';
        run.error = `Step "${step.id}" failed: ${stepResult.result.error}`;
        run.completedAt = Date.now();
        await this.storage.idb.saveRun(run);
        return run;
      }
    }

    run.status = 'completed';
    run.completedAt = Date.now();
    await this.storage.idb.saveRun(run);
    return run;
  }
}
