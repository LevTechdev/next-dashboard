import { registerQrisLedgerPersistence } from "./lib/qris-ledger-store";
import { startScheduler } from "./lib/scheduler";

/**
 * Node.js-runtime startup, called from instrumentation.ts.
 *
 * Never reached by the Edge build: instrumentation.ts imports this module
 * dynamically, only after checking NEXT_RUNTIME, so the Edge bundle does not
 * trace the fs-backed store or the scheduler.
 *
 * - QRIS ledger persistence: the income ledger hydrates from storage and
 *   transactions/disbursements survive a restart.
 * - Scheduler: the periodic jobs (auto-payout, auto-reorder, usage digest,
 *   trial sweep).
 */
export async function registerNodeInstrumentation() {
  registerQrisLedgerPersistence();
  await startScheduler();
}
