import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 仅测试当前工程逻辑层，排除迁移到备份目录的旧项目
    include: ["src/**/*.test.js"],
    exclude: ["_root_legacy_backup/**", "node_modules/**", "dist/**"]
  }
});
