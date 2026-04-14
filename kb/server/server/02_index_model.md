# Mongoose Model 索引

## Model 总览

| # | Model 名 | 文件 | 接口数 | 字段数 | 说明 |
|---|---------|------|--------|--------|------|
| 1 | Agent | models/Agent.ts | 3 | 0 | — |
| 2 | AgentEvaluation | models/AgentEvaluation.ts | 1 | 1 | — |
| 3 | AgentMemory | models/AgentMemory.ts | 2 | 0 | — |
| 4 | Category | models/Category.ts | 1 | 0 | — |
| 5 | Chat | models/Chat.ts | 2 | 0 | — |
| 6 | KnowledgeBase | models/KnowledgeBase.ts | 2 | 0 | — |
| 7 | McpServer | models/McpServer.ts | 3 | 0 | — |
| 8 | Pipeline | models/Pipeline.ts | 2 | 0 | — |
| 9 | Role | models/Role.ts | 2 | 0 | — |
| 10 | Skill | models/Skill.ts | 6 | 1 | — |
| 11 | SkillExecution | models/SkillExecution.ts | 2 | 0 | — |
| 12 | SystemPrompt | models/SystemPrompt.ts | 1 | 0 | — |
| 13 | TokenUsage | models/TokenUsage.ts | 1 | 0 | — |
| 14 | User | models/User.ts | 1 | 0 | — |
| 15 | VibeTemplate | models/VibeTemplate.ts | 1 | 0 | — |
| 16 | shared | models/shared.ts | 2 | 0 | — |
| 17 | Favorite | models/Favorite.ts | 1 | 0 | v1.2.0 新增：用户收藏 Agent |
| 18 | AgentReview | models/AgentReview.ts | 1 | 0 | v1.3.0 新增：Agent 评分评价 |

## Model 详情

### Agent

**文件**: server/src/models/Agent.ts

**接口 `ISection`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| heading | ILocalizedText | — |
| markdown | ILocalizedText | — |
| order | number | — |

**接口 `IPipelineNode`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| nodeId | string | — |
| label | ILocalizedText | — |
| type | string | — |
| dependsOn | string[] | — |
| promptHint | ILocalizedText | — |
| modelType | 'text' | 'vision' | — |

**接口 `IAgent`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| slug | string | — |
| categoryKey | string | — |
| name | ILocalizedText | — |
| description | ILocalizedText | — |
| vibe | ILocalizedText | — |
| emoji | string | — |
| color | string | — |
| sourcePath | string | — |
| rawMarkdown | string | — |
| frontmatter | Record<string, unknown> | — |
| sections | ISection[] | — |
| tags | string[] | — |
| capabilities | ILocalizedText[] | — |
| workflow | { | — |
| summary | ILocalizedText | — |
| nodes | IPipelineNode[] | — |

### AgentEvaluation

**文件**: server/src/models/AgentEvaluation.ts

**接口 `IAgentEvaluation`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| chatId | string | ✅ |
| messageId | string | ✅ |
| evaluationType | 'user_rating' | 'user_feedback' | 'auto_quality' | — |
| rating | number | ✅ |
| feedback | string | ✅ |
| qualityScores | { | ✅ |
| relevance | number | — |
| accuracy | number | — |
| completeness | number | — |
| readability | number | — |
| overall | number | — |

**Schema 字段**:

| 字段 | 类型 | 必填 | 唯一 | 关联 | 默认值 |
|------|------|------|------|------|--------|
| type | Number | — | — | — | — |

### AgentMemory

**文件**: server/src/models/AgentMemory.ts

**接口 `IMemoryEntry`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| memoryId | string | — |
| type | MemoryType | — |
| content | string | — |
| summary | string | — |
| importance | MemoryImportance | — |
| tags | string[] | — |
| embedding | number[] | ✅ |
| accessCount | number | — |
| lastAccessedAt | Date | — |
| createdAt | Date | — |
| expiresAt | Date | ✅ |

**接口 `IAgentMemory`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| userId | string | — |
| agentSlug | string | ✅ |
| sessionId | string | ✅ |
| memories | IMemoryEntry[] | — |
| stats | { | — |
| totalMemories | number | — |
| sessionMemories | number | — |
| longTermMemories | number | — |
| workingMemories | number | — |

### Category

**文件**: server/src/models/Category.ts

**接口 `ICategory`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | ILocalizedText | — |
| description | ILocalizedText | — |
| icon | string | — |
| color | string | — |
| sortOrder | number | — |
| stats | { agentCount: number | — |

### Chat

**文件**: server/src/models/Chat.ts

**接口 `IChatMessage`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| role | 'user' | 'assistant' | 'system' | — |
| content | string | — |
| modelType | 'text' | 'vision' | ✅ |
| provider | 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek' | ✅ |
| timestamp | Date | — |
| imageUrl | string | ✅ |

**接口 `IChat`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| sessionId | string | — |
| agentSlug | string | ✅ |
| agentName | string | ✅ |
| title | string | — |
| messages | IChatMessage[] | — |
| provider | 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek' | — |
| modelType | 'text' | 'vision' | — |
| systemPrompt | string | ✅ |
| sessionType | 'vibe' | 'chat' | ✅ |
| createdAt | Date | — |
| updatedAt | Date | — |

### KnowledgeBase

**文件**: server/src/models/KnowledgeBase.ts

**接口 `IKnowledgeChunk`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| chunkId | string | — |
| content | ILocalizedText | — |
| embedding | number[] | ✅ |
| order | number | — |

**接口 `IKnowledgeBase`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| title | ILocalizedText | — |
| description | ILocalizedText | — |
| sourceType | 'markdown' | 'text' | 'url' | 'pdf' | 'docx' | 'xlsx' | — |
| sourcePath | string | ✅ |
| sourceUrl | string | ✅ |
| categoryKey | string | ✅ |
| agentSlug | string | ✅ |
| chunks | IKnowledgeChunk[] | — |
| tags | string[] | — |
| isActive | boolean | — |
| stats | { | — |
| chunkCount | number | — |
| wordCount | number | — |

### McpServer

**文件**: server/src/models/McpServer.ts

**接口 `IMcpToolParameter`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| name | string | — |
| type | string | — |
| description | string | — |
| required | boolean | — |
| enum | string[] | ✅ |

**接口 `IMcpTool`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| name | string | — |
| description | string | — |
| parameters | IMcpToolParameter[] | — |
| inputSchema | Record<string, unknown> | — |

**接口 `IMcpServer`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | string | — |
| description | string | — |
| icon | string | — |
| transportType | McpTransportType | — |
| stdioConfig | { | ✅ |
| command | string | — |
| args | string[] | — |
| env | Record<string, string> | ✅ |
| cwd | string | ✅ |

### Pipeline

**文件**: server/src/models/Pipeline.ts

**接口 `IPipelineStep`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| title | ILocalizedText | — |
| description | ILocalizedText | — |
| modelType | 'text' | 'vision' | — |
| order | number | — |

**接口 `IPipeline`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | ILocalizedText | — |
| description | ILocalizedText | — |
| systemPrompt | ILocalizedText | — |
| steps | IPipelineStep[] | — |
| createdAt | Date | — |
| updatedAt | Date | — |

### Role

**文件**: server/src/models/Role.ts

**接口 `IPermission`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| resource | ResourceType | — |
| actions | PermissionAction[] | — |

**接口 `IRole`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | string | — |
| description | string | — |
| permissions | IPermission[] | — |
| isBuiltin | boolean | — |
| isActive | boolean | — |
| tenantId | string | ✅ |
| createdAt | Date | — |
| updatedAt | Date | — |

### Skill

**文件**: server/src/models/Skill.ts

**接口 `ISkillStep`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| id | string | — |
| type | SkillStepType | — |
| label | string | — |
| toolName | string | ✅ |

**接口 `ISkillTrigger`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| keywords | string[] | — |
| patterns | string[] | — |
| contextRules | string[] | — |
| intentDescription | string | — |

**接口 `ISkillConfig`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| timeout | number | — |
| retryCount | number | — |
| cacheTTL | number | — |
| concurrency | number | — |
| streamOutput | boolean | — |

**接口 `ISkillInputSchema`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| type | 'object' | — |
| properties | Record<string, { | — |
| type | string | — |
| description | string | — |
| default | unknown | ✅ |
| enum | string[] | ✅ |

**接口 `ISkillVersion`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| version | string | — |
| changelog | string | — |
| stepsSnapshot | ISkillStep[] | — |
| createdAt | Date | — |

**接口 `ISkill`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | string | — |
| description | string | — |
| icon | string | — |
| category | SkillCategory | — |
| inputSchema | ISkillInputSchema | — |
| outputDescription | string | — |
| steps | ISkillStep[] | — |
| triggers | ISkillTrigger | — |
| config | ISkillConfig | — |
| dependsOn | string[] | — |
| version | string | — |
| versions | ISkillVersion[] | — |
| abTestGroup | string | — |
| isActive | boolean | — |
| isBuiltin | boolean | — |
| sortOrder | number | — |
| usageCount | number | — |
| avgDuration | number | — |
| successRate | number | — |
| createdAt | Date | — |
| updatedAt | Date | — |

**Schema 字段**:

| 字段 | 类型 | 必填 | 唯一 | 关联 | 默认值 |
|------|------|------|------|------|--------|
| type | String | — | — | — | — |

### SkillExecution

**文件**: server/src/models/SkillExecution.ts

**接口 `IStepExecution`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| stepId | string | — |
| stepType | string | — |
| stepLabel | string | — |
| status | StepExecStatus | — |
| startedAt | Date | — |
| finishedAt | Date | ✅ |
| duration | number | — |
| toolName | string | ✅ |
| toolInput | Record<string, unknown> | ✅ |
| toolSuccess | boolean | ✅ |
| promptUsed | string | ✅ |
| tokenUsage | { | ✅ |
| promptTokens | number | — |
| completionTokens | number | — |
| totalTokens | number | — |

**接口 `ISkillExecution`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| executionId | string | — |
| skillKey | string | — |
| skillName | string | — |
| skillVersion | string | — |
| abTestGroup | string | — |
| triggerMethod | TriggerMethod | — |
| triggerMatch | string | — |
| sessionId | string | ✅ |
| userId | string | ✅ |
| input | Record<string, unknown> | — |
| output | string | — |
| stepExecutions | IStepExecution[] | — |
| status | ExecStatus | — |
| totalDuration | number | — |
| totalTokens | number | — |
| totalSteps | number | — |
| successSteps | number | — |
| failedSteps | number | — |
| error | string | ✅ |
| createdAt | Date | — |

### SystemPrompt

**文件**: server/src/models/SystemPrompt.ts

**接口 `ISystemPrompt`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| category | PromptCategory | — |
| name | string | — |
| description | string | — |
| content | string | — |
| isActive | boolean | — |
| sortOrder | number | — |
| createdAt | Date | — |
| updatedAt | Date | — |

### TokenUsage

**文件**: server/src/models/TokenUsage.ts

**接口 `ITokenUsage`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| userId | string | ✅ |
| username | string | ✅ |
| tenantId | string | ✅ |
| provider | string | — |
| modelName | string | — |
| callType | 'chat' | 'skill' | 'pipeline' | 'vibe' | 'embedding' | 'agent_plan' | 'multi_agent' | 'other' | — |
| promptTokens | number | — |
| completionTokens | number | — |
| totalTokens | number | — |
| estimatedCost | number | — |
| sessionId | string | ✅ |
| skillKey | string | ✅ |
| duration | number | — |
| success | boolean | — |
| errorMessage | string | ✅ |

### User

**文件**: server/src/models/User.ts

**接口 `IUser`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| username | string | — |
| email | string | — |
| passwordHash | string | — |
| role | string | — |
| avatar | string | ✅ |
| tenantId | string | ✅ |
| oauth | { | ✅ |
| provider | 'github' | 'google' | 'wechat' | — |
| providerId | string | — |
| accessToken | string | ✅ |

### VibeTemplate

**文件**: server/src/models/VibeTemplate.ts

**接口 `IVibeTemplate`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| title | string | — |
| description | string | — |
| category | string | — |
| author | string | — |
| codeParts | { | — |
| html | string | — |
| css | string | — |
| js | string | — |
| jsx | string | ✅ |
| isFullHtml | boolean | ✅ |
| isReact | boolean | ✅ |

### shared

**文件**: server/src/models/shared.ts

**接口 `ILocalizedText`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| zh | string | — |
| en | string | — |

**接口 `SSEContext`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| res | ServerResponse | — |
| send | (data: Record<string, unknown>) => void | — |

### Favorite

**文件**: server/src/models/Favorite.ts
**版本**: v1.2.0 新增

**接口 `IFavorite`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| userId | mongoose.Types.ObjectId | — |
| agentId | mongoose.Types.ObjectId | — |
| createdAt | Date | — |

**索引**:

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| userId_agentId | { userId: 1, agentId: 1 } | 唯一复合 | 防止重复收藏 |
| userId_time | { userId: 1, createdAt: -1 } | 普通复合 | 收藏列表按时间倒序 |
| agentId | { agentId: 1 } | 普通 | 统计 Agent 收藏数 |

**关联关系**:
- userId → User._id（N:1）
- agentId → Agent._id（N:1）

### AgentReview

**文件**: server/src/models/AgentReview.ts
**版本**: v1.3.0 新增

**接口 `IAgentReview`**:

| 字段 | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| userId | string | — |
| username | string | — |
| rating | number | — |
| content | string | — |
| createdAt | Date | — |
| updatedAt | Date | — |

**索引**:

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| slug_user_unique | { agentSlug: 1, userId: 1 } | 唯一复合 | 一人一评 |
| slug_time | { agentSlug: 1, createdAt: -1 } | 普通复合 | 按时间倒序查询 |

**关联关系**:
- agentSlug → Agent.slug（N:1）
- userId → User._id（N:1）

