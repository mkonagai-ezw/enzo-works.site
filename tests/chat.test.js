import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../api/chat.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.CHATBOT_GEMINI_API_KEY;
const originalModel = process.env.CHATBOT_GEMINI_MODEL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({ CHATBOT_GEMINI_API_KEY: originalKey, CHATBOT_GEMINI_MODEL: originalModel })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function request(body = { message: 'Web制作について教えてください' }, method = 'POST') {
  const result = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
  await handler({ method, body }, result);
  return result;
}

test('accepts preflight and rejects unsupported methods without calling AI', async () => {
  globalThis.fetch = () => { throw new Error('Must not call AI'); };
  assert.equal((await request(undefined, 'OPTIONS')).statusCode, 200);
  assert.equal((await request(undefined, 'GET')).statusCode, 405);
});

test('rejects missing, non-string, short and oversized messages', async () => {
  for (const body of [null, {}, { message: 12345 }, { message: '    ' }, { message: '短文' }, { message: 'a'.repeat(2001) }]) {
    assert.equal((await request(body)).statusCode, 400);
  }
});

test('reports missing server configuration without revealing credentials', async () => {
  delete process.env.CHATBOT_GEMINI_API_KEY;
  const result = await request();
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, 'CHAT_NOT_CONFIGURED');
});

test('returns all answer parts, excluding thoughts, with a separate system instruction', async () => {
  process.env.CHATBOT_GEMINI_API_KEY = 'test-key';
  delete process.env.CHATBOT_GEMINI_MODEL;
  globalThis.fetch = async (url, options) => {
    assert.ok(!url.includes('test-key'));
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    const body = JSON.parse(options.body);
    assert.ok(body.systemInstruction.parts[0].text.includes('ENZO WORKS'));
    assert.equal(body.contents[0].parts[0].text, 'Web制作について教えてください');
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: 'Web制作を' }, { text: 'サポートします。' }] }, finishReason: 'STOP' }] });
  };
  const result = await request();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.response, 'Web制作をサポートします。');
});

test('can switch the model through server configuration', async () => {
  process.env.CHATBOT_GEMINI_API_KEY = 'test-key';
  process.env.CHATBOT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/gemini-3.5-flash-lite:generateContent'));
    assert.equal(JSON.parse(options.body).generationConfig.thinkingConfig, undefined);
    return Response.json({ candidates: [{ content: { parts: [{ text: '回答' }] } }] });
  };
  assert.equal((await request()).statusCode, 200);
});

test('distinguishes rate limits, configuration errors and service failures', async () => {
  process.env.CHATBOT_GEMINI_API_KEY = 'test-key';
  for (const [status, code, expectedStatus] of [[402, 'AI_BILLING_REQUIRED', 503], [429, 'AI_RATE_LIMITED', 503], [403, 'AI_CONFIGURATION_ERROR', 503], [404, 'AI_CONFIGURATION_ERROR', 503], [503, 'AI_UNAVAILABLE', 502]]) {
    globalThis.fetch = async () => Response.json({ error: { message: 'sensitive provider details' } }, { status });
    const result = await request();
    assert.equal(result.statusCode, expectedStatus);
    assert.equal(result.body.code, code);
    assert.ok(!JSON.stringify(result.body).includes('sensitive'));
  }
});

test('handles empty and blocked responses without consuming a successful response', async () => {
  process.env.CHATBOT_GEMINI_API_KEY = 'test-key';
  for (const body of [{ candidates: [] }, { candidates: [{ finishReason: 'SAFETY' }] }, { candidates: [{ content: { parts: [{ thought: true, text: 'reasoning only' }] } }] }]) {
    globalThis.fetch = async () => Response.json(body);
    assert.equal((await request()).statusCode, 502);
  }
});

test('returns a retryable timeout when the provider hangs', async () => {
  process.env.CHATBOT_GEMINI_API_KEY = 'test-key';
  globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  const result = await request();
  assert.equal(result.statusCode, 504);
  assert.equal(result.body.code, 'AI_TIMEOUT');
});
