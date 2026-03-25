import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectToMongo, disconnectFromMongo } from '../db/mongo.js';
import { Agent } from '../models/Agent.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 输出目录：server/seed-data/
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'seed-data');
const AGENTS_FILE = path.join(OUTPUT_DIR, 'agents.json');

const run = async () => {
  console.log('📤 Agency Agents — 数据导出脚本');
  console.log('='.repeat(50));
  console.log(`🗄️  MongoDB: ${env.mongodbUri}`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}`);
  console.log('='.repeat(50));

  await connectToMongo();

  try {
    // ── 导出 Agent（去掉 MongoDB 内部字段，保留业务数据）──────────────────
    console.log('\n📦 正在导出 Agent 数据...');

    const agents = await Agent.find({}).lean();

    if (agents.length === 0) {
      console.warn('⚠️  数据库中没有 Agent 数据，请先运行 npm run seed 或 npm run import:agents');
      return;
    }

    // 清理不需要的字段：去掉 _id、__v、createdAt、updatedAt（导入时重新生成）
    const cleanAgents = agents.map(({ _id, __v, createdAt, updatedAt, ...rest }) => rest);

    // 确保输出目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 创建目录: ${OUTPUT_DIR}`);
    }

    // 写入 JSON 文件
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(cleanAgents, null, 2), 'utf-8');

    const fileSizeKB = (fs.statSync(AGENTS_FILE).size / 1024).toFixed(1);

    console.log('\n📊 导出结果:');
    console.log(`  ✅ Agent 数量: ${cleanAgents.length} 个`);
    console.log(`  📄 输出文件: ${AGENTS_FILE}`);
    console.log(`  💾 文件大小: ${fileSizeKB} KB`);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 导出完成！');
    console.log('');
    console.log('📌 后续步骤:');
    console.log('   1. 将 seed-data/agents.json 提交到 Git');
    console.log('   2. 其他人 clone 后运行 npm run seed 即可自动导入');
    console.log('='.repeat(50));
  } finally {
    await disconnectFromMongo();
  }
};

run().catch((err) => {
  console.error('❌ 导出失败:', err);
  process.exit(1);
});
