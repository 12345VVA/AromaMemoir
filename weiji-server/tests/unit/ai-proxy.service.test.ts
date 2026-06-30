// AiProxyService 头白名单转发 单元测试
// forwardMultipart 在转发到 weiji-ai 之前应仅保留白名单 headers，
// 过滤 Host / X-Forwarded-* / Cookie 等可能泄露内部信息的请求头。
// 通过临时覆盖 axios.post 捕获实际传入的 config.headers 进行断言。
import { describe, it } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { AiProxyService } from '../../src/service/ai-proxy.service';

describe('AiProxyService header 白名单转发', () => {
  it('forwardMultipart 仅转发白名单 headers', async () => {
    let capturedHeaders: Record<string, unknown> | null = null;
    const originalPost = axios.post;
    // @ts-expect-error 测试用 mock，仅捕获 config.headers 后短路
    axios.post = async (_url: string, _data: unknown, config: { headers?: Record<string, unknown> }) => {
      capturedHeaders = config?.headers ?? null;
      throw new Error('mock stop'); // 抛错以短路实际请求
    };
    try {
      const fakeCtx: {
        req: unknown;
        headers: Record<string, string>;
      } = {
        req: {},
        headers: {
          'content-type': 'multipart/form-data; boundary=xxx',
          'content-length': '123',
          'authorization': 'Bearer test-token',
          'host': 'evil.example.com',
          'x-forwarded-for': '1.2.3.4',
          'cookie': 'session=abc',
        },
      };
      try {
        await AiProxyService.forwardMultipart(fakeCtx as never, '/ai/recognize');
      } catch {
        // 预期抛错（mock stop），忽略
      }
      assert.ok(capturedHeaders, '应捕获到 headers');
      assert.strictEqual(
        capturedHeaders!['content-type'],
        'multipart/form-data; boundary=xxx',
      );
      assert.strictEqual(capturedHeaders!['content-length'], '123');
      assert.strictEqual(capturedHeaders!['authorization'], 'Bearer test-token');
      assert.strictEqual(capturedHeaders!['host'], undefined, 'host 不应被转发');
      assert.strictEqual(
        capturedHeaders!['x-forwarded-for'],
        undefined,
        'x-forwarded-for 不应被转发',
      );
      assert.strictEqual(capturedHeaders!['cookie'], undefined, 'cookie 不应被转发');
    } finally {
      axios.post = originalPost;
    }
  });
});
