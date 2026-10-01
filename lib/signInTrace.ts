/**
 * Which step of the Google sign-in failed, and what Google actually said [W/15].
 *
 * Android keeps answering "Google Sign-In is not set up in this build" after the account picker, while the
 * same account works on iOS — so consent and scope are fine. Two things made that undiagnosable from here:
 *
 *   The flow is five native calls (hasPlayServices, signInSilently, signIn, addScopes, getTokens) and the
 *   screen reported one word for all of them. DEVELOPER_ERROR can come from signIn or from addScopes, and
 *   those have different causes — a client/certificate that Google will not match, versus a scope request
 *   made in a context the SDK rejects.
 *
 *   And the failure arrived with no detail line at all, which no path in the source can produce: every
 *   return in connectNativeGmail carries one, and signInFailureDetail never returns an empty string. The
 *   most likely explanation is that the device is not running the bundle we think it is — so the trace
 *   records the running update id too, and that question stops being a guess.
 *
 * GoogleSignin.configure() is global and replaces the whole configuration. Two modules call it, and the one
 * in lib/creditAccount.ts passes no `scopes` — so whoever called it last decides what addScopes runs in.
 * Which one that was is recorded here. Nothing about the ordering is changed.
 *
 * Diagnostic only: every instrumented call returns exactly what it returned before.
 *
 * Pure, and unit-tested in lib/signInTrace.test.ts.
 */

/** How many steps are kept. The flow is five calls; a retry or two fits without pushing the first ones out. */
export const MAX_TRACE_STEPS = 12;

export type TraceOutcome = 'running' | 'ok' | 'fail';

export type TraceStep = {
  name: string;
  outcome: TraceOutcome;
  /** Milliseconds the call took, or has been running. */
  ms: number;
  /** Google's own status code, for a failure. */
  code?: string;
  /** Short, technical. Never mail contents. */
  message?: string;
};

type TraceState = {
  steps: TraceStep[];
  startedAt: Map<string, number>;
  configuredBy: string;
  configuredAt: number;
};

const state: TraceState = { steps: [], startedAt: new Map(), configuredBy: '', configuredAt: 0 };

/** A fresh attempt: the previous one's steps are not this one's evidence. */
export function resetSignInTrace(): void {
  state.steps = [];
  state.startedAt.clear();
}

/** Who called GoogleSignin.configure() last, and when. `configure` is global, so this decides the context. */
export function markConfigured(by: string, now = Date.now()): void {
  state.configuredBy = String(by || '').trim() || 'unknown';
  state.configuredAt = now;
}

/** A native call is starting. */
export function traceStep(name: string, now = Date.now()): void {
  const step = String(name || '').trim() || 'step';
  state.startedAt.set(step, now);
  if (state.steps.length >= MAX_TRACE_STEPS) return;
  state.steps.push({ name: step, outcome: 'running', ms: 0 });
}

function settle(name: string, now: number, patch: Partial<TraceStep>): void {
  const step = String(name || '').trim() || 'step';
  const startedAt = state.startedAt.get(step);
  const ms = startedAt == null ? 0 : Math.max(0, now - startedAt);
  // The last entry with this name: a retry adds a step rather than rewriting the first attempt.
  for (let i = state.steps.length - 1; i >= 0; i -= 1) {
    if (state.steps[i].name === step && state.steps[i].outcome === 'running') {
      state.steps[i] = { ...state.steps[i], ...patch, ms };
      return;
    }
  }
}

/** It came back. */
export function traceOk(name: string, now = Date.now()): void {
  settle(name, now, { outcome: 'ok' });
}

/**
 * It failed. `code` is Google's status code where there is one; `message` is trimmed and capped, because this
 * goes on a screen whose contents may well be screenshotted into a message.
 */
export function traceFail(name: string, code?: unknown, message?: unknown, now = Date.now()): void {
  const raw = (message as { message?: unknown } | null)?.message ?? message;
  const text = (typeof raw === 'string' || typeof raw === 'number')
    ? String(raw).replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
  const codeText = (typeof code === 'string' || typeof code === 'number')
    ? String(code).replace(/\s+/g, ' ').trim().slice(0, 40)
    : '';
  settle(name, now, { outcome: 'fail', code: codeText || undefined, message: text || undefined });
}

/**
 * The lines the error screen shows: the steps in order, then who configured the SDK last.
 *
 * Technical and untranslated, like the status code beside it. `bundle` is the running update id, which is
 * the one fact that says whether the code being blamed is the code that ran.
 */
export function signInTraceLines(opts: { bundle?: string } = {}): string[] {
  const lines: string[] = [];
  if (state.steps.length) {
    lines.push(state.steps.map(s => {
      const head = `${s.name} ${s.outcome === 'ok' ? 'ok' : s.outcome === 'fail' ? 'FAIL' : '…'}`;
      const detail = [s.code, s.message].filter(Boolean).join(' ');
      return `${head}${s.ms ? ` ${s.ms}ms` : ''}${detail ? ` ${detail}` : ''}`;
    }).join(' · '));
  }
  if (state.configuredBy) lines.push(`configure by ${state.configuredBy}`);
  const bundle = String(opts.bundle || '').trim();
  if (bundle) lines.push(`bundle ${bundle}`);
  return lines;
}

/** The step that failed, or '' when none did. For a one-line summary beside the reason. */
export function failedStepName(): string {
  const hit = [...state.steps].reverse().find(s => s.outcome === 'fail');
  return hit ? hit.name : '';
}
