# Service 索引

## Service 总览

| # | Service 名 | 文件 | 导出函数数 | 依赖 Model | 依赖 Service |
|---|-----------|------|-----------|-----------|-------------|
| 1 | agentIngestionService | services/agentIngestionService.ts | 6 | Agent, Category, Pipeline, KnowledgeBase | — |
| 2 | compileService | services/compileService.ts | 1 | — | — |
| 3 | documentParser | services/documentParser.ts | 4 | — | — |
| 4 | embeddingService | services/embeddingService.ts | 7 | KnowledgeBase, type IKnowledgeBase | — |
| 5 | evaluationService | services/evaluationService.ts | 3 | AgentEvaluation, type IAgentEvaluation | — |
| 6 | knowledgeScheduler | services/knowledgeScheduler.ts | 4 | KnowledgeBase | — |
| 7 | knowledgeService | services/knowledgeService.ts | 4 | KnowledgeBase, IKnowledgeChunk, Agent, Category | — |
| 8 | llmService | services/llmService.ts | 6 | — | — |
| 9 | mcpService | services/mcpService.ts | 11 | McpServer, type IMcpServer, type IMcpTool | — |
| 10 | memoryService | services/memoryService.ts | 7 | AgentMemory, type IMemoryEntry, type MemoryType, type MemoryImportance | — |
| 11 | multiAgentService | services/multiAgentService.ts | 3 | Agent, type IAgent | — |
| 12 | providerRegistry | services/providerRegistry.ts | 11 | — | — |
| 13 | skillEngine | services/skillEngine.ts | 3 | Skill, type ISkill, type ISkillStep, SkillExecution, type ISkillExecution, type IStepExecution, type ExecStatus, type TriggerMethod, SystemPrompt | — |
| 14 | skillRouter | services/skillRouter.ts | 2 | Skill, type ISkill, TriggerMethod | — |

## Service 摘要

### agentIngestionService

**文件**: server/src/services/agentIngestionService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| getTranslateStatus | — |
| translateAgentsInBackground | — |
| processMarkdownFile | — |
| syncCategories | — |
| ingestAgentsFromMarkdown | — |
| ingestKnowledgeFromAgents | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| Agent | Model | — |
| Category | Model | — |
| Pipeline | Model | — |
| KnowledgeBase | Model | — |
| node:fs/promises | 外部库 | — |
| node:path | 外部库 | — |
| gray-matter | 外部库 | — |
| slugify | 外部库 | — |
| glob | 外部库 | — |

### compileService

**文件**: server/src/services/compileService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| compileJsx | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| sucrase | 外部库 | — |

### documentParser

**文件**: server/src/services/documentParser.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| isSupportedDocument | — |
| getFileType | — |
| parseDocument | — |
| chunkDocumentContent | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| node:fs | 外部库 | — |
| node:path | 外部库 | — |

### embeddingService

**文件**: server/src/services/embeddingService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| getEmbedding | — |
| batchGetEmbeddings | — |
| cosineSimilarity | — |
| buildKnowledgeEmbeddings | — |
| buildAllKnowledgeEmbeddings | — |
| semanticSearch | — |
| hybridSearch | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| KnowledgeBase | Model | — |
| type IKnowledgeBase | Model | — |
| axios | 外部库 | — |

### evaluationService

**文件**: server/src/services/evaluationService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| submitUserRating | — |
| autoEvaluateQuality | — |
| getAgentEvalStats | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| AgentEvaluation | Model | — |
| type IAgentEvaluation | Model | — |

### knowledgeScheduler

**文件**: server/src/services/knowledgeScheduler.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| updateUrlKnowledge | — |
| updateAllUrlKnowledge | — |
| startKnowledgeScheduler | — |
| stopKnowledgeScheduler | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| KnowledgeBase | Model | — |
| axios | 外部库 | — |
| uuid | 外部库 | — |

### knowledgeService

**文件**: server/src/services/knowledgeService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| createKnowledgeEntry | — |
| searchKnowledge | — |
| ragQuery | — |
| ragQueryStream | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| KnowledgeBase | Model | — |
| IKnowledgeChunk | Model | — |
| Agent | Model | — |
| Category | Model | — |
| uuid | 外部库 | — |

### llmService

**文件**: server/src/services/llmService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| streamOllama | — |
| streamOpenAI | — |
| callLLMWithTools | — |
| callLLM | — |
| streamLLM | — |
| getAvailableProviders | — |

### mcpService

**文件**: server/src/services/mcpService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| connectMcpServer | — |
| disconnectMcpServer | — |
| executeMcpTool | — |
| getMcpToolDefinitions | — |
| parseMcpToolName | — |
| getMcpServerStatuses | — |
| disconnectAllMcpServers | — |
| discoverMcpResources | — |
| readMcpResource | — |
| discoverMcpPrompts | — |
| getMcpPromptMessages | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| McpServer | Model | — |
| type IMcpServer | Model | — |
| type IMcpTool | Model | — |
| node:child_process | 外部库 | — |
| axios | 外部库 | — |

### memoryService

**文件**: server/src/services/memoryService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| addMemory | — |
| getMemories | — |
| deleteMemory | — |
| searchMemories | — |
| consolidateMemories | — |
| getMemoryContext | — |
| autoExtractMemory | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| AgentMemory | Model | — |
| type IMemoryEntry | Model | — |
| type MemoryType | Model | — |
| type MemoryImportance | Model | — |
| uuid | 外部库 | — |

### multiAgentService

**文件**: server/src/services/multiAgentService.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| sequentialCollaboration | — |
| parallelCollaboration | — |
| debateCollaboration | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| Agent | Model | — |
| type IAgent | Model | — |
| uuid | 外部库 | — |

### providerRegistry

**文件**: server/src/services/providerRegistry.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| getProviderConfig | — |
| callClaude | — |
| streamClaude | — |
| callGemini | — |
| streamGemini | — |
| callDeepSeek | — |
| streamDeepSeek | — |
| callWithFallback | — |
| trackTokenUsage | — |
| getDailyTokenStats | — |
| isOverBudget | — |

### skillEngine

**文件**: server/src/services/skillEngine.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| executeSkill | — |
| getSkillExecutionHistory | — |
| getSkillStats | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| Skill | Model | — |
| type ISkill | Model | — |
| type ISkillStep | Model | — |
| SkillExecution | Model | — |
| type ISkillExecution | Model | — |
| type IStepExecution | Model | — |
| type ExecStatus | Model | — |
| type TriggerMethod | Model | — |
| SystemPrompt | Model | — |
| uuid | 外部库 | — |
| node:crypto | 外部库 | — |

### skillRouter

**文件**: server/src/services/skillRouter.ts

**导出函数**:

| 函数 | 说明 |
|------|------|
| invalidateSkillCache | — |
| matchSkill | — |

**依赖**:

| 依赖 | 类型 | 用途 |
|------|------|------|
| Skill | Model | — |
| type ISkill | Model | — |
| TriggerMethod | Model | — |

