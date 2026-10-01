import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_TRACE_STEPS,
  failedStepName,
  markConfigured,
  resetSignInTrace,
  signInTraceLines,
  traceFail,
  traceOk,
  traceStep,
} from './signInTrace.ts';

test('[W/15] the Android case reads off one line: which step, which code', () => {
  resetSignInTrace();
  markConfigured('gmail', 0);
  traceStep('hasPlayServices', 100); traceOk('hasPlayServices', 220);
  traceStep('signIn', 300); traceOk('signIn', 4600);
  traceStep('addScopes', 4700); traceFail('addScopes', 10, 'DEVELOPER_ERROR', 4950);
  const lines = signInTraceLines({ bundle: '01a0f55f' });
  assert.equal(
    lines[0],
    'hasPlayServices ok 120ms · signIn ok 4300ms · addScopes FAIL 250ms 10 DEVELOPER_ERROR',
  );
  assert.equal(lines[1], 'configure by gmail');
  assert.equal(lines[2], 'bundle 01a0f55f');
  assert.equal(failedStepName(), 'addScopes', 'so signIn and addScopes are never confused');
});

test('[W/15] a step that never came back stays visible as running', () => {
  resetSignInTrace();
  traceStep('signIn', 1000);
  assert.ok(signInTraceLines()[0].startsWith('signIn …'), signInTraceLines()[0]);
  assert.equal(failedStepName(), '', 'running is not failed');
});

test('[W/15] who configured the SDK last is recorded, because configure is global', () => {
  resetSignInTrace();
  markConfigured('gmail', 0);
  markConfigured('credits', 50);
  assert.ok(signInTraceLines().includes('configure by credits'));
  // And it survives a reset of the steps: the configuration is not per attempt.
  resetSignInTrace();
  assert.ok(signInTraceLines().includes('configure by credits'));
});

test('[W/15] an empty or odd caller name still names something', () => {
  resetSignInTrace();
  markConfigured('   ', 0);
  assert.ok(signInTraceLines().includes('configure by unknown'));
});

test('[W/15] a retry adds a step rather than rewriting the first attempt', () => {
  resetSignInTrace();
  traceStep('signIn', 0); traceFail('signIn', 10, 'DEVELOPER_ERROR', 100);
  traceStep('signIn', 200); traceOk('signIn', 500);
  const line = signInTraceLines()[0];
  assert.ok(line.includes('signIn FAIL'), line);
  assert.ok(line.includes('signIn ok 300ms'), line);
});

test('[W/15] the message is flattened and capped, and no mail contents can fit', () => {
  resetSignInTrace();
  traceStep('getTokens', 0);
  traceFail('getTokens', 'ERR', `  a\n\nb  ${'x'.repeat(300)}`, 10);
  const line = signInTraceLines()[0];
  assert.ok(!line.includes('\n'));
  assert.ok(line.length < 160, `got ${line.length}`);
});

test('[W/15] a non-string code or message is dropped rather than printed as [object Object]', () => {
  resetSignInTrace();
  traceStep('signIn', 0);
  traceFail('signIn', {}, [], 5);
  assert.equal(signInTraceLines()[0], 'signIn FAIL 5ms');
});

test('[W/15] the step list cannot grow without bound', () => {
  resetSignInTrace();
  for (let i = 0; i < 40; i += 1) { traceStep(`s${i}`, i); traceOk(`s${i}`, i); }
  assert.equal(signInTraceLines()[0].split(' · ').length, MAX_TRACE_STEPS);
});

test('[W/15] nothing traced yields no lines, not empty ones', () => {
  resetSignInTrace();
  markConfigured('', 0);
  const lines = signInTraceLines();
  assert.ok(!lines.some(l => !l.trim()));
});

test('[W/15] the bundle id is only shown when there is one', () => {
  resetSignInTrace();
  traceStep('signIn', 0); traceOk('signIn', 1);
  assert.ok(!signInTraceLines().some(l => l.startsWith('bundle')));
  assert.ok(signInTraceLines({ bundle: 'embedded' }).includes('bundle embedded'));
});
