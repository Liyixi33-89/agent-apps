import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectToMongo, disconnectFromMongo } from '../db/mongo.js';
import { ingestAgentsFromMarkdown, ingestKnowledgeFromAgents } from '../services/agentIngestionService.js';
import { env } from '../config/env.js';
import { Agent } from '../models/Agent.js';
import { KnowledgeBase } from '../models/KnowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// seed-data 目录：server/seed-data/
const SEED_DATA_DIR = path.resolve(__dirname, '..', '..', 'seed-data');
const AGENTS_FILE = path.join(SEED_DATA_DIR, 'agents.json');

// ── 从 JSON 文件导入 Agent ──────────────────────────────────────────────────
const seedFromJsonFile = async (): Promise<{ count: number; created: number; updated: number }> => {
  const rawData = fs.readFileSync(AGENTS_FILE, 'utf-8');
  const agents: Record<string, unknown>[] = JSON.parse(rawData);

  let created = 0;
  let updated = 0;

  for (const agentData of agents) {
    const slug = agentData.slug as string;
    if (!slug) continue;

    const result = await Agent.findOneAndUpdate(
      { slug },
      { $set: agentData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 判断是新建还是更新（通过 createdAt 和 updatedAt 是否相近）
    const doc = result as any;
    const isNew = Math.abs(doc.createdAt?.getTime() - doc.updatedAt?.getTime()) < 1000;
    if (isNew) created++;
    else updated++;
  }

  return { count: agents.length, created, updated };
};

const run = async () => {
  console.log('🌱 Agency Agents — 数据初始化脚本');
  console.log('='.repeat(50));
  console.log(`🗄️  MongoDB: ${env.mongodbUri}`);
  console.log('='.repeat(50));

  await connectToMongo();

  try {
    // ── Step 1: 同步 Agent ──────────────────────────────────────────────────
    const hasJsonFile = fs.existsSync(AGENTS_FILE);

    if (hasJsonFile) {
      // 优先：从 JSON 文件导入（适合线上部署/他人使用）
      console.log(`\n📦 Step 1/2: 从 JSON 文件导入 Agent 数据...`);
      console.log(`   文件: ${AGENTS_FILE}`);

      const { count, created, updated } = await seedFromJsonFile();

      console.log('\n📊 Agent 导入结果:');
      console.log(`  ✅ 总计: ${count} 个 Agent`);
      console.log(`  🆕 新建: ${created}`);
      console.log(`  🔄 更新: ${updated}`);
    } else {
      // 回退：从 Markdown 文件扫描（适合本地开发）
      console.log(`\n📦 Step 1/2: 未找到 JSON 文件，从 Markdown 扫描 Agent 数据...`);
      console.log(`   Markdown 根目录: ${env.ingestRoot}`);
      console.log(`   💡 提示: 运行 npm run export 可将数据导出为 JSON 文件`);

      const agentResult = await ingestAgentsFromMarkdown(env.ingestRoot, true);

      console.log('\n📊 Agent 同步结果:');
      console.log(`  ✅ 总计: ${agentResult.totalAgents} 个 Agent`);
      console.log(`  🆕 新建: ${agentResult.created}`);
      console.log(`  🔄 更新: ${agentResult.updated}`);
      console.log(`  📂 分类: ${agentResult.totalCategories} 个`);
      if (agentResult.errors.length > 0) {
        console.log(`  ❌ 失败: ${agentResult.errors.length} 个`);
        agentResult.errors.forEach(({ file, error }) => {
          console.log(`     - ${file}: ${error}`);
        });
      }

      if (agentResult.totalAgents === 0) {
        console.warn('\n⚠️  未找到任何 Agent，请检查以下配置:');
        console.warn(`   - INGEST_ROOT 当前路径: ${env.ingestRoot}`);
        console.warn(`   - 或将 seed-data/agents.json 放入 ${SEED_DATA_DIR}`);
        return;
      }
    }

    // ── Step 2: 生成知识库 ──────────────────────────────────────────────────
    console.log('\n📚 Step 2/2: 将 Agent 数据向量化写入知识库...');
    const knowledgeResult = await ingestKnowledgeFromAgents();

    console.log('\n📊 知识库生成结果:');
    console.log(`  ✅ 处理 Agent: ${knowledgeResult.totalAgents} 个`);
    console.log(`  📝 知识块总数: ${knowledgeResult.totalChunks} 个`);
    console.log(`  🆕 新建条目: ${knowledgeResult.created}`);
    console.log(`  🔄 更新条目: ${knowledgeResult.updated}`);
    if (knowledgeResult.errors.length > 0) {
      console.log(`  ❌ 失败: ${knowledgeResult.errors.length} 个`);
      knowledgeResult.errors.forEach(({ slug, error }) => {
        console.log(`     - ${slug}: ${error}`);
      });
    }

    // ── 汇总 ────────────────────────────────────────────────────────────────
    const agentTotal = await Agent.countDocuments();
    const knowledgeTotal = await KnowledgeBase.countDocuments();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 初始化完成！');
    console.log(`   Agent 总数: ${agentTotal} 个`);
    console.log(`   知识库总数: ${knowledgeTotal} 条（${knowledgeResult.totalChunks} 个知识块）`);
    console.log('='.repeat(50));
  } finally {
    await disconnectFromMongo();
  }
};

run().catch((err) => {
  console.error('❌ 初始化失败:', err);
  process.exit(1);
});
