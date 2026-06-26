#!/usr/bin/env bash
# 味记项目全量测试入口
# 依次运行三服务测试，任一失败即整体失败 exit 1
set -e

# 脚本所在目录的父目录即为项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

PASS=0
FAIL=0
FAILED_SERVICES=()

echo "=========================================="
echo "味记项目全量测试"
echo "=========================================="
echo ""

# ------------------------------------------------
# 1. weiji-server (Node.js + node:test + supertest)
# ------------------------------------------------
echo "[1/3] weiji-server 测试..."
cd "$ROOT_DIR/weiji-server"
if npm test; then
  echo "✓ weiji-server 测试通过"
  PASS=$((PASS + 1))
else
  echo "✗ weiji-server 测试失败"
  FAIL=$((FAIL + 1))
  FAILED_SERVICES+=("weiji-server")
fi
echo ""

# ------------------------------------------------
# 2. weiji-ai (Python + pytest)
# ------------------------------------------------
echo "[2/3] weiji-ai 测试..."
cd "$ROOT_DIR/weiji-ai"
if pytest; then
  echo "✓ weiji-ai 测试通过"
  PASS=$((PASS + 1))
else
  echo "✗ weiji-ai 测试失败"
  FAIL=$((FAIL + 1))
  FAILED_SERVICES+=("weiji-ai")
fi
echo ""

# ------------------------------------------------
# 3. weiji-admin-web (Vitest)
# ------------------------------------------------
echo "[3/3] weiji-admin-web 测试..."
cd "$ROOT_DIR/weiji-admin-web"
if npm test; then
  echo "✓ weiji-admin-web 测试通过"
  PASS=$((PASS + 1))
else
  echo "✗ weiji-admin-web 测试失败"
  FAIL=$((FAIL + 1))
  FAILED_SERVICES+=("weiji-admin-web")
fi
echo ""

# ------------------------------------------------
# 汇总
# ------------------------------------------------
echo "=========================================="
echo "测试汇总"
echo "=========================================="
echo "通过: $PASS / 3"
echo "失败: $FAIL / 3"
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo "失败的服务: ${FAILED_SERVICES[*]}"
fi
echo ""

if [ $FAIL -gt 0 ]; then
  echo "✗ 全量测试未通过"
  exit 1
fi

echo "✓ 全量测试通过"
exit 0
