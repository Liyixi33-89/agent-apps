# TypeScript 类型定义索引

## index.ts

**文件**: src\types\index.ts

### 接口

#### LocalizedText

| 字段 | 类型 | 可选 |
|------|------|------|
| zh | string | — |
| en | string | — |

#### Agent

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| slug | string | — |
| categoryKey | string | — |
| name | LocalizedText | — |
| description | LocalizedText | — |
| vibe | LocalizedText | — |
| emoji | string | — |
| color | string | — |
| sourcePath | string | — |
| rawMarkdown | string | — |
| frontmatter | Record<string, unknown> | — |
| sections | Section[] | — |
| tags | string[] | — |
| capabilities | LocalizedText[] | — |
| workflow | { | — |
| summary | LocalizedText | — |
| nodes | WorkflowNode[] | — |
| modelPreferences | { | — |
| primary | 'text' | 'vision' | — |
| recommendedProvider | 'ollama' | 'openai' | — |
| stats | { | — |
| sectionCount | number | — |
| wordCount | number | — |
| createdAt | string | — |
| updatedAt | string | — |

#### Section

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| heading | LocalizedText | — |
| markdown | LocalizedText | — |
| order | number | — |

#### WorkflowNode

| 字段 | 类型 | 可选 |
|------|------|------|
| nodeId | string | — |
| label | LocalizedText | — |
| type | string | — |
| dependsOn | string[] | — |
| promptHint | LocalizedText | — |
| modelType | 'text' | 'vision' | — |

#### Category

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| key | string | — |
| name | LocalizedText | — |
| description | LocalizedText | — |
| icon | string | — |
| color | string | — |
| sortOrder | number | — |
| stats | { agentCount: number } | — |

#### Pipeline

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| key | string | — |
| name | LocalizedText | — |
| description | LocalizedText | — |
| systemPrompt | LocalizedText | — |
| steps | PipelineStep[] | — |
| createdAt | string | — |

#### PipelineStep

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| title | LocalizedText | — |
| description | LocalizedText | — |
| modelType | 'text' | 'vision' | — |
| order | number | — |

#### ChatMessage

| 字段 | 类型 | 可选 |
|------|------|------|
| role | 'user' | 'assistant' | 'system' | — |
| content | string | — |
| timestamp | string | — |
| provider | Provider | ✅ |
| imageUrl | string | ✅ |

#### ChatSession

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| sessionId | string | — |
| agentSlug | string | ✅ |
| agentName | string | ✅ |
| title | string | — |
| messages | ChatMessage[] | — |
| provider | Provider | — |
| modelType | 'text' | 'vision' | — |
| updatedAt | string | — |

#### KnowledgeBase

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| title | LocalizedText | — |
| description | LocalizedText | — |
| sourceType | 'markdown' | 'text' | 'url' | — |
| categoryKey | string | ✅ |
| agentSlug | string | ✅ |
| tags | string[] | — |
| isActive | boolean | — |
| stats | { chunkCount: number | — |
| wordCount | number } | — |
| createdAt | string | — |

#### OverviewStats

| 字段 | 类型 | 可选 |
|------|------|------|
| agentCount | number | — |
| categoryCount | number | — |
| pipelineCount | number | — |
| knowledgeCount | number | — |

#### SystemPrompt

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| key | string | — |
| category | 'vibe' | 'pipeline' | — |
| name | string | — |
| description | string | — |
| content | string | — |
| isActive | boolean | — |
| sortOrder | number | — |
| createdAt | string | — |
| updatedAt | string | — |

#### PlanStep

| 字段 | 类型 | 可选 |
|------|------|------|
| id | string | — |
| index | number | — |
| title | string | — |
| description | string | — |
| tools | string[] | — |
| agentSlug | string | ✅ |
| inputFrom | string[] | — |
| expectedOutput | string | — |
| status | StepStatus | — |
| result | string | ✅ |
| error | string | ✅ |
| retryCount | number | — |
| skippable | boolean | — |

#### ExecutionPlan

| 字段 | 类型 | 可选 |
|------|------|------|
| planId | string | — |
| userPrompt | string | — |
| complexity | TaskComplexity | — |
| complexityReason | string | — |
| steps | PlanStep[] | — |
| goal | string | — |
| totalSteps | number | — |
| createdAt | string | — |

#### ToolDefinitionParam

| 字段 | 类型 | 可选 |
|------|------|------|
| type | string | — |
| description | string | — |
| enum | string[] | ✅ |

#### ToolDefinition

| 字段 | 类型 | 可选 |
|------|------|------|
| name | string | — |
| description | string | — |
| parameters | { | — |
| type | string | — |
| properties | Record<string, ToolDefinitionParam> | — |
| required | string[] | — |

#### ProviderInfo

| 字段 | 类型 | 可选 |
|------|------|------|
| provider | Provider | — |
| configured | boolean | — |
| textModel | string | — |
| visionModel | string | — |

#### TokenUsageStats

| 字段 | 类型 | 可选 |
|------|------|------|
| totalTokens | number | — |
| totalCost | number | — |
| callCount | number | — |
| avgDuration | number | — |
| successRate | number | — |
| budget | number | — |
| remaining | number | — |

#### TokenUsageRecord

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| provider | string | — |
| model | string | — |
| callType | string | — |
| promptTokens | number | — |
| completionTokens | number | — |
| totalTokens | number | — |
| estimatedCost | number | — |
| duration | number | — |
| success | boolean | — |
| createdAt | string | — |

#### Role

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| key | string | — |
| name | string | — |
| description | string | — |
| permissions | Array<{ resource: string | — |
| actions | string[] }> | — |
| isBuiltin | boolean | — |
| isActive | boolean | — |
| createdAt | string | — |

#### UserInfo

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| username | string | — |
| email | string | — |
| role | string | — |
| avatar | string | ✅ |
| tenantId | string | ✅ |
| preferences | { | ✅ |
| lang | 'zh' | 'en' | — |
| theme | 'light' | 'dark' | 'auto' | — |
| defaultProvider | string | ✅ |
| dailyTokenQuota | number | — |
| todayTokenUsed | number | — |
| isActive | boolean | — |
| lastLoginAt | string | ✅ |
| createdAt | string | — |

#### MemoryEntry

| 字段 | 类型 | 可选 |
|------|------|------|
| memoryId | string | — |
| type | 'session' | 'long_term' | 'working' | — |
| content | string | — |
| summary | string | — |
| importance | 'low' | 'medium' | 'high' | 'critical' | — |
| tags | string[] | — |
| accessCount | number | — |
| lastAccessedAt | string | — |
| createdAt | string | — |

#### SemanticSearchResult

| 字段 | 类型 | 可选 |
|------|------|------|
| knowledgeId | string | — |
| title | LocalizedText | — |
| chunkId | string | — |
| content | LocalizedText | — |
| score | number | — |
| categoryKey | string | ✅ |
| agentSlug | string | ✅ |

#### CollaborationStepResult

| 字段 | 类型 | 可选 |
|------|------|------|
| agentSlug | string | — |
| agentName | string | — |
| output | string | — |
| duration | number | — |
| status | 'success' | 'failed' | — |
| error | string | ✅ |

#### McpTemplate

| 字段 | 类型 | 可选 |
|------|------|------|
| key | string | — |
| name | string | — |
| description | string | — |
| icon | string | — |
| category | string | — |
| transportType | 'stdio' | 'sse' | — |
| installGuide | string | — |
| expectedTools | Array<{ name: string | — |
| description | string }> | — |

#### ExtensionsStatus

| 字段 | 类型 | 可选 |
|------|------|------|
| multiProvider | { enabled: boolean | — |
| activeProvider | string | — |
| configuredProviders | string[] } | — |
| rag | { enabled: boolean | — |
| embeddingProvider | string | — |
| embeddingModel | string } | — |
| rbac | { enabled: boolean | — |
| builtinRoles | string[] } | — |
| multiTenant | { enabled: boolean } | — |
| tokenBudget | { enabled: boolean | — |
| dailyBudget | number | — |
| userQuota | number } | — |
| rateLimit | { enabled: boolean | — |
| perMinute | number } | — |
| memory | { enabled: boolean } | — |
| multiAgent | { enabled: boolean | — |
| modes | string[] } | — |
| mcpMarket | { enabled: boolean | — |
| templateCount | number } | — |

#### SkillStep

| 字段 | 类型 | 可选 |
|------|------|------|
| id | string | — |
| type | SkillStepType | — |
| label | string | — |
| toolName | string | ✅ |
| toolArgs | Record<string, string> | ✅ |
| promptKey | string | ✅ |
| promptTemplate | string | ✅ |
| llmOptions | { temperature?: number | ✅ |
| maxTokens | number | ✅ |
| stream | boolean } | ✅ |
| condition | string | ✅ |
| ifTrue | string | ✅ |
| ifFalse | string | ✅ |
| transformExpr | string | ✅ |
| parallelStepIds | string[] | ✅ |
| subSkillKey | string | ✅ |
| subSkillInput | Record<string, string> | ✅ |
| maxNestingDepth | number | ✅ |
| inputMapping | Record<string, string> | ✅ |
| outputKey | string | — |
| optional | boolean | — |
| timeout | number | — |
| retryCount | number | — |

#### Skill

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| key | string | — |
| name | string | — |
| description | string | — |
| icon | string | — |
| category | SkillCategory | — |
| inputSchema | { type: string | — |
| properties | Record<string, unknown> | — |
| required | string[] } | — |
| outputDescription | string | — |
| steps | SkillStep[] | — |
| triggers | { keywords: string[] | — |
| patterns | string[] | — |
| contextRules | string[] | — |
| intentDescription | string } | — |
| config | { timeout: number | — |
| retryCount | number | — |
| cacheTTL | number | — |
| concurrency | number | — |
| streamOutput | boolean } | — |
| dependsOn | string[] | — |
| version | string | — |
| isActive | boolean | — |
| isBuiltin | boolean | — |
| sortOrder | number | — |
| usageCount | number | — |
| avgDuration | number | — |
| successRate | number | — |
| createdAt | string | — |
| updatedAt | string | — |

#### SkillExecutionResult

| 字段 | 类型 | 可选 |
|------|------|------|
| executionId | string | — |
| skillKey | string | — |
| success | boolean | — |
| output | unknown | — |
| error | string | ✅ |
| totalDuration | number | — |
| totalTokens | number | — |
| stepResults | Array<{ stepId: string | — |
| status | string | — |
| duration | number | — |
| outputSummary | string }> | — |

#### GraphNode

| 字段 | 类型 | 可选 |
|------|------|------|
| id | string | — |
| label | string | — |
| type | 'agent' | 'category' | 'skill' | 'knowledge' | 'tool' | — |
| emoji | string | ✅ |
| color | string | ✅ |
| size | number | ✅ |
| metadata | Record<string, unknown> | ✅ |

#### GraphEdge

| 字段 | 类型 | 可选 |
|------|------|------|
| source | string | — |
| target | string | — |
| label | string | — |
| type | 'belongs_to' | 'uses_skill' | 'has_knowledge' | 'depends_on' | 'collaborates' | 'uses_tool' | — |
| weight | number | ✅ |

#### KnowledgeGraphData

| 字段 | 类型 | 可选 |
|------|------|------|
| nodes | GraphNode[] | — |
| edges | GraphEdge[] | — |
| stats | { | — |
| totalNodes | number | — |
| totalEdges | number | — |
| agentCount | number | — |
| categoryCount | number | — |
| skillCount | number | — |
| knowledgeCount | number | — |
| toolCount | number | ✅ |
| mcpCount | number | ✅ |

#### AgentMarketItem

| 字段 | 类型 | 可选 |
|------|------|------|
| _id | string | — |
| slug | string | — |
| name | LocalizedText | — |
| description | LocalizedText | — |
| emoji | string | — |
| color | string | — |
| categoryKey | string | — |
| tags | string[] | — |
| modelPreferences | { primary: 'text' | 'vision' | — |
| recommendedProvider | string } | — |
| stats | { sectionCount: number | — |
| wordCount | number } | — |
| updatedAt | string | — |
| category | { key: string | ✅ |
| name | LocalizedText | — |
| icon | string } | — |

#### AgentExportFormat

| 字段 | 类型 | 可选 |
|------|------|------|
| formatVersion | '1.0.0' | — |
| exportedAt | string | — |
| platform | 'agency-agents' | — |
| agent | { | — |
| slug | string | — |
| categoryKey | string | — |
| name | LocalizedText | — |
| description | LocalizedText | — |
| vibe | LocalizedText | — |
| emoji | string | — |
| color | string | — |
| tags | string[] | — |
| capabilities | LocalizedText[] | — |
| workflow | { summary: LocalizedText | — |
| nodes | WorkflowNode[] } | — |
| modelPreferences | { primary: 'text' | 'vision' | — |
| recommendedProvider | string } | — |
| sections | Section[] | — |
| knowledgeSummary | Array<{ title: LocalizedText | ✅ |
| description | LocalizedText | — |
| sourceType | string | — |
| tags | string[] }> | — |

#### McpResource

| 字段 | 类型 | 可选 |
|------|------|------|
| uri | string | — |
| name | string | — |
| description | string | ✅ |
| mimeType | string | ✅ |

#### McpPrompt

| 字段 | 类型 | 可选 |
|------|------|------|
| name | string | — |
| description | string | ✅ |
| arguments | Array<{ name: string | ✅ |
| description | string | ✅ |
| required | boolean }> | ✅ |

### 类型别名

| 类型名 | 定义 |
|--------|------|
| Provider | 'ollama' | 'openai' | 'claude' | 'gemini' | 'deepseek' |
| ModelType | 'text' | 'vision' |
| Lang | 'zh' | 'en' |
| TaskComplexity | 'simple' | 'moderate' | 'complex' |
| StepStatus | 'pending' | 'running' | 'done' | 'failed' | 'skipped' |
| PlanSSEEvent | | { type: 'start' |
| ReActSSEEvent | | { type: 'start' |
| CollaborationMode | 'sequential' | 'parallel' | 'debate' |
| SkillCategory | 'research' | 'coding' | 'analysis' | 'creative' | 'workflow' |
| SkillStepType | 'tool' | 'llm' | 'condition' | 'transform' | 'parallel' | 's |

