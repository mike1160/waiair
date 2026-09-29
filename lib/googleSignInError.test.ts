import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyGoogleSignInError,
  signInErrorCode,
  signInFailureDetail,
  signInFailureIsRetryable,
} from './googleSignInError.ts';

/** The four the SDK names, as it exports them on Android. */
const CODES = {
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: '12500',
  SIGN_IN_REQUIRED: '4',
};

test('[W/6] DEVELOPER_ERROR is recognised however it arrives', () => {
  // The one that matters: an unregistered package name or signing certificate. The SDK does not name it,
  // so every shape it comes in has to be matched.
  assert.equal(classifyGoogleSignInError({ code: 10 }, CODES), 'misconfigured');
  assert.equal(classifyGoogleSignInError({ code: '10' }, CODES), 'misconfigured');
  assert.equal(classifyGoogleSignInError({ code: 'DEVELOPER_ERROR' }, CODES), 'misconfigured');
  assert.equal(classifyGoogleSignInError({ message: 'DEVELOPER_ERROR' }, CODES), 'misconfigured');
  assert.equal(classifyGoogleSignInError({ message: 'Sign in failed, statusCode=10' }, CODES), 'misconfigured');
});

test('[W/6] a misconfigured build is never offered a retry', () => {
  assert.equal(signInFailureIsRetryable('misconfigured'), false, 'this is the loop the traveller was stuck in');
  assert.equal(signInFailureIsRetryable('cancelled'), false, 'a cancel is not a failure to retry');
  assert.equal(signInFailureIsRetryable('network'), true);
  assert.equal(signInFailureIsRetryable('no_play_services'), true);
  assert.equal(signInFailureIsRetryable('error'), true);
});

test('[W/6] the SDK\'s own codes win, because their values differ by platform', () => {
  assert.equal(classifyGoogleSignInError({ code: '12501' }, CODES), 'cancelled');
  assert.equal(classifyGoogleSignInError({ code: 'ASYNC_OP_IN_PROGRESS' }, CODES), 'in_progress');
  assert.equal(classifyGoogleSignInError({ code: '12500' }, CODES), 'no_play_services');
  // iOS uses names rather than numbers for the same conditions.
  assert.equal(classifyGoogleSignInError({ code: 'ERR_SIGN_IN_CANCELLED' }, null), 'cancelled');
  assert.equal(classifyGoogleSignInError({ code: 'SIGN_IN_CANCELLED' }, null), 'cancelled');
});

test('[W/6] a network failure is classified as one, and stays retryable', () => {
  assert.equal(classifyGoogleSignInError({ code: 7 }, CODES), 'network');
  assert.equal(classifyGoogleSignInError({ code: 'NETWORK_ERROR' }, CODES), 'network');
});

test('[W/6] an unrecognisable error stays honestly unclassified', () => {
  assert.equal(classifyGoogleSignInError(new Error('socket hang up'), CODES), 'error');
  assert.equal(classifyGoogleSignInError({}, CODES), 'error');
  assert.equal(classifyGoogleSignInError(null, CODES), 'error');
  assert.equal(classifyGoogleSignInError(undefined), 'error');
  assert.equal(classifyGoogleSignInError({ code: '99999' }, CODES), 'error');
});

test('[W/6] the raw code is read out rather than guessed at', () => {
  assert.equal(signInErrorCode({ code: 10 }), '10');
  assert.equal(signInErrorCode({ code: ' DEVELOPER_ERROR ' }), 'DEVELOPER_ERROR');
  assert.equal(signInErrorCode({ message: 'statusCode: 12501' }), '12501');
  assert.equal(signInErrorCode({ code: NaN }), '', 'a NaN code is no code');
  assert.equal(signInErrorCode({ code: '' }), '');
  assert.equal(signInErrorCode(null), '');
});

test('[W/6] the detail line carries both the classification and the code', () => {
  assert.equal(signInFailureDetail('misconfigured', '10'), 'misconfigured · 10');
  assert.equal(signInFailureDetail('error', ''), 'error', 'no code, no separator dangling');
});
