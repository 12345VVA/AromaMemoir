import { Get, Inject, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
  CoolUrlTag,
  CoolTag,
  TagTypes,
} from '@cool-midway/core';
import { AiProxyService } from '../../../ai/service/ai_proxy';

/**
 * 开放接口（公开健康检查）
 */
@Provide()
@CoolController({ api: [], prefix: '/open', description: '开放接口' })
@CoolUrlTag()
export class OpenHealthController extends BaseController {
  @Inject()
  aiProxyService: AiProxyService;

  /**
   * 健康检查
   * 返回 { status: 'ok', ai: 'up' | 'down' }
   * ai 字段动态读取 AiProxyService.aiStatus（启动时 + 每 60s 定时健康检查维护）
   */
  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/health', { summary: '健康检查' })
  async health() {
    return this.ok({
      status: 'ok',
      ai: this.aiProxyService.aiStatus,
    });
  }
}
