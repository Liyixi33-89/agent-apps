import { connectToMongo, disconnectFromMongo } from '../db/mongo.js';
import { ingestAgentsFromMarkdown } from '../services/agentIngestionService.js';
import { env } from '../config/env.js';

const run = async () => {
  console.log('🚀 开始导入 Agent 数据...');
  console.log(`📁 根目录: ${env.ingestRoot}`);

  await connectToMongo();

  try {
    const result = await ingestAgentsFromMarkdown(env.ingestRoot);
    console.log('\n📊 导入结果:');
    console.log(`  ✅ 总计: ${result.totalAgents} 个 Agent`);
    console.log(`  🆕 新建: ${result.created}`);
    console.log(`  🔄 更新: ${result.updated}`);
    console.log(`  📂 分类: ${result.totalCategories} 个`);
    if (result.errors.length > 0) {
      console.log(`  ❌ 失败: ${result.errors.length} 个`);
      result.errors.forEach(({ file, error }) => {
        console.log(`     - ${file}: ${error}`);
      });
    }
  } finally {
    await disconnectFromMongo();
  }
};

run().catch((err) => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});
