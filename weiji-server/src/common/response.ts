// 统一响应辅助函数
// 与前端 client.ts 契约一致：响应体为 { code, data, message }

export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

// 成功响应：code=0
export function ok<T>(data: T, message: string = ''): ApiResponse<T> {
  return { code: 0, data, message };
}

// 失败响应：code != 0
export function fail<T = null>(message: string, code: number = 1, data: T | null = null): ApiResponse<T> {
  return { code, data, message };
}

// 401 未登录响应（统一格式）
export function unauthorized(message: string = '未登录或登录已过期'): ApiResponse<null> {
  return { code: 401, data: null, message };
}

// 403 无权限响应
export function forbidden(message: string = '无权限访问'): ApiResponse<null> {
  return { code: 403, data: null, message };
}
