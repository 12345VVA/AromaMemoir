import { Controller, Get } from '../common/decorators';
import { AiProxyService } from '../service/ai-proxy.service';

// 健康检查控制器
// GET /health 返回后端服务状态和 AI 服务连通性
// /health 在 JWT 白名单内，可被外部访问
@Controller()
export class HealthController {
  // GET /health
  // 返回 { status: 'ok', ai: 'up' | 'down' }
  // ai 字段动态读取 AiProxyService.aiStatus（由启动时和每 60s 定时健康检查维护）
  @Get('/health')
  health(): { status: string; ai: string } {
    return { status: 'ok', ai: AiProxyService.aiStatus };
  }
}
