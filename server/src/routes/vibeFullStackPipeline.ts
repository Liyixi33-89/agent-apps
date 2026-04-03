/**
 * @file routes/vibeFullStackPipeline.ts
 * @description § 7d  Vibe Coding — 全栈 CRUD Pipeline（6步流水线）
 *
 * 执行顺序：
 *   Step 1 - 需求分析 Agent      → 拆解功能模块、数据实体、API 清单
 *   Step 2 - 数据库架构 Agent    → 设计 MongoDB Schema + 索引 + 验证
 *   Step 3 - 后端工程 Agent      → 生成 Koa 路由 + Service + 中间件
 *   Step 4 - 前端工程 Agent      → 生成 React 页面 + API 调用层
 *   Step 5 - UI/UX 设计师 Agent  → 增强页面视觉设计、交互体验、动画效果
 *   Step 6 - 质检整合 Agent      → 审查全部代码 → 安全 + 一致性 + 完整性
 *   Step 7 - 编译验证 + AI 修复  → esbuild 编译前端代码，失败则 AI 自动修复（最多 3 轮）
 *
 * 路由列表：
 *   POST /api/vibe/fullstack-pipeline  → 全栈 Pipeline 流式生成（SSE）
 */

import Router from '@koa/router';
import { SystemPrompt } from '../models/SystemPrompt.js';
import type { ISystemPrompt } from '../models/SystemPrompt.js';
import { VibeTemplate } from '../models/VibeTemplate.js';
import { env } from '../config/env.js';
import { streamWithContinuation } from '../lib/llmUtils.js';
import { deployAppBackend } from './vibeAppRuntime.js';
import { compileJsx } from '../services/compileService.js';

export const vibeFullStackPipelineRouter = new Router();

// =============================================================================
// § 7d-a  全栈 Pipeline Prompt 常量
// =============================================================================

const FS_ANALYST_PROMPT = `你是一个资深全栈需求分析师，专精于 Node.js + React + MongoDB 技术栈。
请对用户的全栈应用需求进行详细的结构化分析，输出以下内容（纯文本，不要写代码）：

1. 【应用概述】应用类型、核心业务场景、目标用户
2. 【功能模块清单】每个模块一行，格式：模块名 - 功能描述 - CRUD 操作列表
3. 【数据实体设计】
   - 列出所有数据实体（如 User、Product、Order 等）
   - 每个实体的关键字段（字段名、类型、是否必填、默认值）
   - 实体间的关系（一对多、多对多等）
4. 【API 接口清单】
   - 格式：HTTP方法 路径 - 功能描述 - 请求参数 - 返回数据
   - 按模块分组列出所有 RESTful API

要求：分析要全面、具体、可执行，总字数不超过 1500 字。`;

const FS_DB_ARCHITECT_PROMPT = `你是一个 MongoDB 数据库架构师，专精于 Mongoose ODM。
请根据需求分析，为每个数据实体生成完整的 Mongoose Model 代码。

【输出格式要求】
每个 Model 用独立的代码块输出，格式：
\`\`\`typescript:models/ModelName.ts
// 完整的 Mongoose Model 代码
\`\`\`

【代码规范 - 必须严格遵守】
1. 使用 TypeScript 严格模式
2. 每个 Model 文件必须包含：
   - Interface 定义（IModelName extends Document）
   - Schema 定义（含字段验证、默认值、索引）
   - Model 导出
3. 字段验证规则：
   - 字符串字段：trim: true，必填字段加 required
   - 数字字段：min/max 范围限制
   - 枚举字段：enum 约束
   - 引用字段：ref 关联
4. 必须包含的通用字段：
   - timestamps: true（自动 createdAt/updatedAt）
   - isDeleted: Boolean（软删除标记）
5. 索引设计：
   - 常用查询字段建立索引
   - 唯一字段建立唯一索引
   - 复合查询建立复合索引
6. 密码字段必须标记 select: false

【安全要求】
- 禁止在 Schema 中存储明文密码
- 敏感字段（如 password）必须设置 select: false
- 所有用户输入字段必须有长度限制（maxlength）

请直接输出所有 Model 代码，不要输出解释文字。`;

const FS_BACKEND_ENGINEER_PROMPT = `你是一个资深 Node.js 后端工程师，专精于 Koa.js + TypeScript。
请根据需求分析和数据库 Schema，生成完整的后端 CRUD 代码。

【输出格式要求】
按以下顺序输出，每个文件用独立代码块：

1. 路由文件：
\`\`\`typescript:routes/moduleName.ts
// Koa Router 路由定义
\`\`\`

2. Service 文件：
\`\`\`typescript:services/moduleNameService.ts
// 业务逻辑层
\`\`\`

3. 中间件文件（如需要）：
\`\`\`typescript:middleware/auth.ts
// 认证/授权中间件
\`\`\`

4. 环境变量模板：
\`\`\`env:.env.template
# 环境变量模板
\`\`\`

【代码规范 - 必须严格遵守】
1. 路由层（Controller）：
   - 使用 @koa/router
   - 只负责参数校验、调用 Service、返回响应
   - 统一响应格式：{ success: boolean, data?: any, message?: string, pagination?: object }
   - 分页参数：page（默认1）、limit（默认20，最大100）
2. Service 层：
   - 封装所有业务逻辑和数据库操作
   - 使用 async/await
   - 错误使用自定义 Error 类抛出
3. 中间件：
   - auth 中间件：JWT 验证 + 角色检查
   - validate 中间件：请求参数校验
4. 每个 CRUD 操作必须完整实现：
   - Create：参数校验 → 创建 → 返回
   - Read：支持分页、搜索、筛选、排序
   - Update：参数校验 → 查找 → 更新 → 返回
   - Delete：软删除（isDeleted: true）

【安全要求 - 必须严格遵守】
1. 所有路由必须添加 auth 中间件（公开接口除外）
2. 密码必须使用 bcrypt 加密（cost factor >= 10）
3. 禁止直接拼接用户输入到 MongoDB 查询（防注入）
4. 分页 limit 上限 100（防 DoS）
5. 敏感操作（删除、修改权限）必须检查角色权限
6. 所有输入必须做类型和长度校验

请直接输出所有后端代码文件，不要输出解释文字。`;

const FS_FRONTEND_ENGINEER_PROMPT = `你是一个资深 React 前端工程师，专精于 React 18 + 纯 CSS 内联样式。
请根据需求分析和 API 接口清单，生成完整的前端 React 页面代码。

【输出格式要求】
输出一个完整的 React 组件，用代码块包裹：
\`\`\`jsx
// 完整的 React 前端代码（单文件，包含所有页面和组件）
\`\`\`

【⚠️ 代码长度限制 - 最高优先级】
你的输出 token 有限，必须用最紧凑的方式写完所有模块。关键策略：
1. **使用 CRUD 页面工厂**：写一个通用的 CrudPage 组件，接收 columns/fields/apiName 配置，自动生成完整 CRUD 页面
2. **每个模块只需一行配置**：如 <CrudPage apiName="order" columns={orderColumns} fields={orderFields} />
3. **绝对不要为每个模块重复写 CRUD 逻辑**，这是代码被截断的主要原因
4. 变量名可以适当缩短（如 s 代替 styles），样式对象用展开运算符复用
5. 不要写注释，不要写空行，代码越短越好

【架构设计 - 极其重要】
必须严格按照以下架构，确保代码紧凑且所有模块完整：

\`\`\`
// 1. 样式常量（一个 S 对象包含所有样式）
const S = { bg:'#0f172a', card:'#1e293b', border:'#334155', primary:'#7c3aed', ... };

// 2. API 工厂函数（一个函数生成所有 CRUD 方法）
const api = (name) => ({ list:(p)=>fetch(...), create:(d)=>fetch(...), update:(id,d)=>fetch(...), del:(id)=>fetch(...) });

// 3. 通用组件（Table, Modal, Pagination）— 所有页面复用
const Table = ({columns, data, onEdit, onDel}) => ...;
const Modal = ({show, title, onClose, children, onOk}) => ...;
const Pagination = ({page, total, onChange}) => ...;

// 4. ⭐ CrudPage 工厂组件（核心！接收配置自动生成完整 CRUD 页面）
const CrudPage = ({apiName, title, columns, fields, mockData}) => {
  // 内置：列表查询、搜索、分页、新增弹窗、编辑弹窗、删除确认
  // 所有 CRUD 逻辑只写一次！
};

// 5. 各模块配置（每个模块只需定义 columns 和 fields）
const orderColumns = [...]; const orderFields = [...];
const productColumns = [...]; const productFields = [...];
// ... 其他模块

// 6. App 主组件（侧边栏 + 页面切换）
const App = () => {
  const [page, setPage] = useState('order');
  const pages = { order: <CrudPage apiName="order" .../>, product: <CrudPage .../>, ... };
  return <div>侧边栏 + {pages[page]}</div>;
};
export default App;
\`\`\`

【CrudPage 工厂组件 - 必须实现的功能】
CrudPage 接收以下 props：
- apiName: string — API 实体名（如 'order'）
- title: string — 页面标题
- columns: Array<{key, label, render?}> — 表格列配置
- fields: Array<{key, label, type, options?}> — 表单字段配置（type: 'text'|'number'|'select'|'textarea'）
- mockData?: Array — 降级 mock 数据（至少 3 条）

CrudPage 内部自动实现：
a. 列表查询 + 搜索 + 分页
b. 新增弹窗 + 表单
c. 编辑弹窗 + 数据回填
d. 删除确认
e. API 失败时降级到 mockData

【⚠️ 防御性编程 - 极其重要（违反必崩溃）】
所有变量在调用 .map() / .filter() / .forEach() / .find() 之前，必须确保是数组：
1. **props 解构必须给默认值**：const CrudPage = ({columns = [], fields = [], data = [], mockData = [], ...}) => ...
2. **API 返回值必须兜底**：const list = (res.data || []); 而不是直接 res.data.map(...)
3. **所有 .map() 前必须防御**：(Array.isArray(data) ? data : []).map(...) 或 (data || []).map(...)
4. **对象属性访问用可选链**：item?.name || '' 而不是 item.name
5. **分页 total 兜底**：const total = res?.pagination?.total || res?.total || 0;
6. **fetch 响应必须 try-catch**：
   \`\`\`
   let list = []; let total = 0;
   try { const res = await fetch(...).then(r=>r.json()); list = res.data || []; total = res.total || 0; } catch(e) { list = mockData || []; }
   \`\`\`
7. **CrudPage 内部所有状态初始化必须有值**：useState([]) 而不是 useState()，useState(0) 而不是 useState()
8. **render 中的条件渲染**：{(items || []).length > 0 && ...} 而不是 {items.length > 0 && ...}
9. **useEffect 依赖项禁止使用每次渲染都变化的引用**：
   - ❌ 错误：useEffect(() => { load() }, [load]) 其中 load 依赖了 props 中的数组/对象
   - ✅ 正确：用 useRef 保存 props 中的数组/对象，useCallback 依赖 ref 而非 props
   - ❌ 错误：useCallback(fn, [props.columns, props.mockData]) — 数组 props 每次渲染都是新引用
   - ✅ 正确：const mockRef = useRef(mockData); mockRef.current = mockData; useCallback(fn, [svc]) — 只依赖稳定引用
   - ❌ 错误：useEffect(() => { setState(props.data) }, [props.data]) — 对象/数组 props 每次都变
   - ✅ 正确：useEffect(() => { setState(props.data) }, [JSON.stringify(props.data)]) 或用 useRef
10. **useEffect 必须有依赖数组**：禁止写 useEffect(() => { ... }) 不带第二个参数，必须写 useEffect(() => { ... }, [])

【代码规范】
1. React 函数组件 + Hooks
2. 原生 CSS 内联样式（style 对象），禁止 className
3. 深色主题，配色美观
4. export default App
5. 【极其重要】确保所有括号（圆括号、花括号、方括号）严格配对闭合，尤其是多层嵌套的 React.createElement 调用和箭头函数。每个 ( 必须有对应的 )，每个 { 必须有对应的 }，每个 [ 必须有对应的 ]。括号不匹配会导致编译失败。

【禁止事项】
- ❌ 禁止 import/require 语句
- ❌ 禁止外部库（antd、axios、lodash 等）
- ❌ 禁止 className
- ❌ 禁止 React Router（用 state 切换）
- ❌ 禁止为每个模块重复写 CRUD 逻辑（必须用 CrudPage 工厂）
- ❌ 禁止将业务 props 透传到原生 DOM 元素（如 <button {...props}>），必须解构出业务属性后再传递，例如：const Button = ({dataSource, onDel, children, ...domProps}) => <button {...domProps}>{children}</button>

【API 路径格式】
fetch('/api/' + apiName + '?page=1&limit=20')
fetch('/api/' + apiName, {method:'POST', ...})
fetch('/api/' + apiName + '/' + id, {method:'PUT', ...})
fetch('/api/' + apiName + '/' + id, {method:'DELETE'})

【UI 设计】
1. 深色主题（#0f172a / #1e293b / #334155）
2. 主色调紫色（#7c3aed）
3. 左侧边栏 + 顶部栏 + 内容区
4. 表格行悬停高亮，按钮有 hover 效果

【✅ 参考骨架 — 照着这个结构写，确保完整】
以下是一个最小可运行的 CrudPage 工厂骨架，你必须在此基础上扩展：

\`\`\`jsx
const S={bg:'#0f172a',card:'#1e293b',border:'#334155',primary:'#7c3aed',primaryHover:'#6d28d9',text:'#f1f5f9',textDim:'#94a3b8',danger:'#ef4444',success:'#22c55e'};
const api=(name)=>({
  list:async(p=1)=>{try{const r=await fetch('/api/'+name+'?page='+p+'&limit=20');return await r.json()}catch(e){return{data:[],total:0}}},
  create:async(d)=>{try{const r=await fetch('/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});return await r.json()}catch(e){return null}},
  update:async(id,d)=>{try{const r=await fetch('/api/'+name+'/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});return await r.json()}catch(e){return null}},
  del:async(id)=>{try{await fetch('/api/'+name+'/'+id,{method:'DELETE'})}catch(e){}}
});
const CrudPage=({apiName='',title='',columns=[],fields=[],mockData=[]})=>{
  const[data,setData]=React.useState([]);const[total,setTotal]=React.useState(0);
  const[page,setPage]=React.useState(1);const[showModal,setShowModal]=React.useState(false);
  const[editItem,setEditItem]=React.useState(null);const[form,setForm]=React.useState({});
  const[loading,setLoading]=React.useState(false);
  const svc=React.useMemo(()=>api(apiName),[apiName]);
  const mockRef=React.useRef(mockData);mockRef.current=mockData;
  const load=React.useCallback(async(p=1)=>{setLoading(true);try{const r=await svc.list(p);setData(r?.data||mockRef.current||[]);setTotal(r?.total||0);setPage(p)}catch(e){setData(mockRef.current||[])}finally{setLoading(false)}},[svc]);
  React.useEffect(()=>{load()},[load]);
  const handleSave=async()=>{if(editItem?._id){await svc.update(editItem._id,form)}else{await svc.create(form)};setShowModal(false);setForm({});setEditItem(null);load(page)};
  const handleEdit=(item)=>{setEditItem(item);setForm({...item});setShowModal(true)};
  const handleDel=async(id)=>{if(confirm('确认删除?')){await svc.del(id);load(page)}};
  return React.createElement('div',{style:{padding:24}},
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:16}},
      React.createElement('h2',{style:{color:S.text,margin:0}},title),
      React.createElement('button',{onClick:()=>{setEditItem(null);setForm({});setShowModal(true)},style:{background:S.primary,color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,cursor:'pointer'}},'+ 新增')),
    React.createElement('table',{style:{width:'100%',borderCollapse:'collapse'}},
      React.createElement('thead',null,React.createElement('tr',null,(columns||[]).map((c,i)=>React.createElement('th',{key:i,style:{padding:12,textAlign:'left',borderBottom:'1px solid '+S.border,color:S.textDim}},c.label)),React.createElement('th',{style:{padding:12,borderBottom:'1px solid '+S.border,color:S.textDim}},'操作'))),
      React.createElement('tbody',null,(data||[]).map((row,ri)=>React.createElement('tr',{key:row?._id||ri,style:{borderBottom:'1px solid '+S.border}},
        (columns||[]).map((c,ci)=>React.createElement('td',{key:ci,style:{padding:12,color:S.text}},c.render?c.render(row[c.key],row):String(row?.[c.key]??''))),
        React.createElement('td',{style:{padding:12}},
          React.createElement('button',{onClick:()=>handleEdit(row),style:{background:'transparent',color:S.primary,border:'none',cursor:'pointer',marginRight:8}},'编辑'),
          React.createElement('button',{onClick:()=>handleDel(row?._id),style:{background:'transparent',color:S.danger,border:'none',cursor:'pointer'}},'删除')))))),
    showModal&&React.createElement('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}},
      React.createElement('div',{style:{background:S.card,padding:24,borderRadius:12,minWidth:400}},
        React.createElement('h3',{style:{color:S.text,marginTop:0}},editItem?'编辑':'新增'),
        (fields||[]).map((f,i)=>React.createElement('div',{key:i,style:{marginBottom:12}},
          React.createElement('label',{style:{color:S.textDim,display:'block',marginBottom:4}},f.label),
          f.type==='select'?React.createElement('select',{value:form[f.key]||'',onChange:e=>setForm({...form,[f.key]:e.target.value}),style:{width:'100%',padding:8,background:S.bg,color:S.text,border:'1px solid '+S.border,borderRadius:6}},(f.options||[]).map((o,oi)=>React.createElement('option',{key:oi,value:o.value||o},o.label||o))):
          React.createElement('input',{value:form[f.key]||'',onChange:e=>setForm({...form,[f.key]:e.target.value}),style:{width:'100%',padding:8,background:S.bg,color:S.text,border:'1px solid '+S.border,borderRadius:6,boxSizing:'border-box'}}))),
        React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}},
          React.createElement('button',{onClick:()=>setShowModal(false),style:{padding:'8px 16px',background:'transparent',color:S.textDim,border:'1px solid '+S.border,borderRadius:6,cursor:'pointer'}},'取消'),
          React.createElement('button',{onClick:handleSave,style:{padding:'8px 16px',background:S.primary,color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}},'保存')))))
};
// 然后每个模块只需配置 columns 和 fields：
// const orderColumns=[{key:'orderNo',label:'订单号'},{key:'status',label:'状态'}];
// const orderFields=[{key:'orderNo',label:'订单号',type:'text'},{key:'status',label:'状态',type:'select',options:['pending','completed']}];
// <CrudPage apiName="order" title="订单管理" columns={orderColumns} fields={orderFields} mockData={[{_id:'1',orderNo:'ORD001',status:'pending'}]} />
export default App;
\`\`\`

请在此骨架基础上扩展，添加更多模块配置、侧边栏导航、搜索功能等。确保每个模块都有 mockData 兜底。

请直接输出完整代码，不要解释。`;



const FS_UI_DESIGNER_PROMPT = `你是一个顶级 UI/UX 设计师，专精于 React 应用的视觉设计和交互体验优化。
你的任务是审查前端 React 代码，并输出一份 **视觉增强后的完整前端代码**。

【你的设计哲学】
- 「少即是多」— 克制使用装饰，让内容本身成为设计
- 「一致性优先」— 统一的设计语言贯穿每个像素
- 「动效有意义」— 每个动画都服务于用户认知，而非炫技

【⚠️ 最高优先级 — 代码长度控制】
你的输出 token 有限！请遵循以下原则：
1. **在原有代码基础上增强**，不要从零重写
2. 主要修改样式对象（S 常量）和组件的 style 属性
3. 新增的动画/交互代码要紧凑
4. 保持原有的 CrudPage 工厂模式架构不变

【视觉增强清单 — 必须执行】

一、🎨 配色系统升级：
- 建立完整的设计 Token：主色、辅色、成功/警告/错误色、中性色阶（50-950）
- 主色调使用渐变（如 linear-gradient），避免纯色大面积填充
- 深色主题下确保文字对比度 ≥ 4.5:1（WCAG AA）
- 状态色语义化：绿色=成功、橙色=警告、红色=错误、蓝色=信息

二、✨ 微交互与动画：
- 按钮 hover：轻微上浮（translateY(-1px)）+ 阴影加深 + 背景色渐变
- 卡片 hover：边框发光效果（box-shadow 带主色调透明度）
- 列表项进入：淡入 + 微上移动画（opacity 0→1, translateY 8px→0）
- 模态框：背景模糊（backdropFilter: blur(8px)）+ 缩放弹入
- 页面切换：淡入过渡（transition opacity 200ms）
- 加载状态：骨架屏或脉冲动画，不要空白等待
- 删除操作：确认弹窗带红色警告色调

三、📐 布局与间距优化：
- 使用 8px 网格系统（所有间距为 8 的倍数：8, 16, 24, 32, 48）
- 侧边栏：毛玻璃效果（backdrop-filter: blur）+ 细微边框
- 内容区：合理的最大宽度限制，大屏居中
- 表格：斑马纹行、固定表头、行悬停高亮
- 表单：输入框聚焦时边框高亮 + 标签动画

四、🔤 字体与排版：
- 标题层级清晰：H1(24px/bold) > H2(20px/semibold) > H3(16px/medium)
- 正文 14px，辅助文字 12px，行高 1.6
- 数字使用等宽字体特性（tabular-nums）
- 长文本截断用省略号（text-overflow: ellipsis）

五、🎯 组件增强：
- 按钮：主按钮渐变背景 + 次按钮描边样式 + 危险按钮红色调
- 标签/Badge：圆角胶囊形状 + 语义化配色
- 空状态：居中图标 + 友好提示文案 + 操作引导按钮
- Toast/通知：右上角滑入 + 自动消失 + 不同类型不同颜色
- 分页器：当前页高亮 + 悬停效果

六、♿ 无障碍增强：
- 所有可交互元素添加 tabIndex={0}
- 按钮和链接添加 aria-label
- 焦点可见样式（outline 或 ring）
- 颜色不作为唯一信息传达方式（配合图标/文字）

【输出格式】
输出一个完整的增强后 React 组件，用代码块包裹：
\`\`\`jsx
// 增强后的完整 React 前端代码
\`\`\`

【禁止事项】
- ❌ 禁止 import/require 语句
- ❌ 禁止外部库（antd、axios、lodash、framer-motion 等）
- ❌ 禁止 className（只用 style 内联样式）
- ❌ 禁止删除任何已有功能
- ❌ 禁止改变 API 路径和数据结构

请直接输出增强后的完整代码，不要输出解释文字。`;

const FS_REVIEWER_PROMPT = `你是一个全栈代码质检专家，负责审查和修复全栈项目的所有代码。

【⚠️ 最高优先级 — 代码长度控制】
你的输出 token 有限！请遵循以下原则：
1. **前端代码如果基本完整，直接原样输出**，不要重写
2. 只修复明确的 bug（如 import 语句、className 使用、API 路径错误）
3. 后端代码同理，只修复问题，不要重构
4. 如果代码已经正确，直接复制粘贴原代码到对应代码块中

【审查清单 — 快速检查】

一、前端硬性规则（违反必修复）：
- ❌ 有 import/require 语句 → 删除
- ❌ 有 className → 改为 style
- ❌ 用了 axios → 改为 fetch
- ❌ 缺少 export default → 补上
- ❌ 缺少 CRUD 功能 → 补全（使用 CrudPage 工厂模式）
- ❌ data.map() 没有防御 → 改为 (data || []).map() 或 (Array.isArray(data) ? data : []).map()
- ❌ 直接使用 res.data 没有兜底 → 改为 (res.data || [])
- ❌ 括号不匹配（圆括号/花括号/方括号未正确闭合）→ 逐行检查并修复，尤其是多层嵌套的 React.createElement 和箭头函数
- ❌ 组件 props 没有默认值 → 必须给默认值，如 ({columns = [], fields = [], data = []}) => ...
- ❌ useState() 没有初始值 → 必须给初始值，如 useState([])、useState('')、useState(0)
- ❌ fetch 没有 try-catch → 必须包裹 try-catch 并提供降级数据
- ❌ 对象属性直接访问没有可选链 → 改为 item?.name || ''

二、API 路径一致性：
- 前端 fetch 路径以 /api/ 开头
- 实体名小写（/api/order、/api/product）

三、后端检查：
- 路由有认证中间件
- 密码 bcrypt 加密
- 分页 limit 上限 100

【输出格式 — 每个文件一个代码块】

\`\`\`typescript:models/ALL_MODELS
// Model 代码（如无修改，原样输出）
\`\`\`

\`\`\`typescript:routes/ALL_ROUTES
// 路由代码
\`\`\`

\`\`\`typescript:services/ALL_SERVICES
// Service 代码
\`\`\`

\`\`\`typescript:middleware/ALL_MIDDLEWARE
// 中间件代码
\`\`\`

\`\`\`env:.env.template
// 环境变量
\`\`\`

\`\`\`jsx
// 前端 React 代码（⚠️ 如果原代码基本正确，直接原样输出！不要重写！）
\`\`\`

只输出代码块，不要输出解释文字。`;

// =============================================================================
// § 7d-b  工具函数
// =============================================================================

/** 从数据库读取 Prompt，不存在则使用内置 fallback */
const getPrompt = async (key: string, fallback = ''): Promise<string> => {
  const doc = await SystemPrompt.findOne<ISystemPrompt>({ key, isActive: true }).lean();
  return doc?.content ?? fallback;
};

/** 加载所有全栈 Pipeline Agent 的 Prompt */
const getFullStackAgents = async () => ({
  analyst:     await getPrompt('fs_pipeline_analyst',     FS_ANALYST_PROMPT),
  dbArchitect: await getPrompt('fs_pipeline_db_architect', FS_DB_ARCHITECT_PROMPT),
  backend:     await getPrompt('fs_pipeline_backend',     FS_BACKEND_ENGINEER_PROMPT),
  frontend:    await getPrompt('fs_pipeline_frontend',    FS_FRONTEND_ENGINEER_PROMPT),
  uiDesigner:  await getPrompt('fs_pipeline_ui_designer', FS_UI_DESIGNER_PROMPT),
  reviewer:    await getPrompt('fs_pipeline_reviewer',    FS_REVIEWER_PROMPT),
});

/** 截断文本到指定字符数，保留完整行 */
const truncateText = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');
  return (lastNewline > maxChars * 0.8 ? truncated.slice(0, lastNewline) : truncated) + '\n... (已截断)';
};

/** 带超时的 Promise 包装 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 超时（${ms / 1000}s），本地模型可能无法处理过长的上下文`)), ms)
    ),
  ]);

/**
 * 执行单个 Pipeline 步骤（流式收集，返回完整内容）
 *
 * 增强特性：
 *   - 超时保护（整体超时 + chunk 间隔超时）
 *   - 心跳回调（SSE 保活）
 *   - 实时进度回调（向前端推送已生成字符数和续写次数）
 *   - 续写感知（检测到续写时通知前端）
 *   - 空输出保护（模型完全卡住时提前结束）
 */
const runStep = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { provider: string; modelType: string; temperature?: number; maxTokens?: number; model?: string },
  stepOptions?: {
    timeoutMs?: number;
    onHeartbeat?: () => void;
    onProgress?: (info: { chars: number; continuations: number }) => void;
    label?: string;
  }
): Promise<string> => {
  const timeoutMs = stepOptions?.timeoutMs ?? 300_000; // 默认 5 分钟超时
  const label = stepOptions?.label ?? 'Pipeline Step';

  const execute = async (): Promise<string> => {
    let result = '';
    let lastChunkTime = Date.now();
    let continuations = 0;
    const CHUNK_TIMEOUT = 60_000; // 单个 chunk 间隔超时 60 秒（更快检测模型卡住）
    const PROGRESS_INTERVAL = 3_000; // 每 3 秒推送一次进度
    let lastProgressTime = 0;

    const stream = streamWithContinuation(messages, {
      provider: options.provider,
      modelType: options.modelType,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      model: options.model,
    });
    for await (const chunk of stream) {
      const now = Date.now();

      if (chunk.delta) {
        result += chunk.delta;
        lastChunkTime = now;

        // 定期推送进度
        if (now - lastProgressTime > PROGRESS_INTERVAL) {
          lastProgressTime = now;
          stepOptions?.onProgress?.({ chars: result.length, continuations });
        }
      }

      // 检测续写事件
      if ('continuationIndex' in chunk && chunk.continuationIndex) {
        continuations = chunk.continuationIndex;
        console.log(`[${label}] 续写第 ${continuations} 次，已累计 ${result.length} 字符`);
        stepOptions?.onProgress?.({ chars: result.length, continuations });
      }

      // 检查单个 chunk 间隔是否超时（模型卡住不输出）
      if (now - lastChunkTime > CHUNK_TIMEOUT && !chunk.done) {
        console.warn(`[${label}] 模型超过 ${CHUNK_TIMEOUT / 1000}s 未输出新内容，提前结束（已收集 ${result.length} 字符）`);
        break;
      }

      // 心跳回调（用于 SSE 保活）
      stepOptions?.onHeartbeat?.();
      if (chunk.done) break;
    }

    // 空输出保护
    if (!result.trim()) {
      throw new Error(`[${label}] 模型未返回任何内容，可能是上下文过长或模型不可用`);
    }

    console.log(`[${label}] 完成，共 ${result.length} 字符，续写 ${continuations} 次`);
    return result;
  };

  return withTimeout(execute(), timeoutMs, label);
};

// =============================================================================
// § 7d-c  代码提取工具函数
// =============================================================================

/** 从 LLM 输出中提取带文件路径标注的代码块 */
const extractTaggedCodeBlocks = (raw: string): Array<{ tag: string; content: string }> => {
  const blocks: Array<{ tag: string; content: string }> = [];
  const regex = /```(?:typescript|ts|javascript|js|json|env|jsx|tsx):([^\n]+)\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push({ tag: match[1].trim(), content: match[2].trim() });
  }
  return blocks;
};

/** 从 LLM 输出中提取 JSX 代码块 */
const extractJsxBlock = (raw: string): string => {
  const match = raw.match(/```(?:jsx|tsx)\n([\s\S]*?)```/i);
  if (match) return match[1].trim();
  // 降级：尝试匹配未闭合的代码块
  const openMatch = raw.match(/```(?:jsx|tsx)\n([\s\S]+)$/i);
  if (openMatch) return openMatch[1].trim();
  return '';
};

/** 从 LLM 输出中提取 JSON 代码块 */
const extractJsonBlock = (raw: string, fileTag: string): string => {
  // 优先匹配带文件标签的代码块
  const taggedRegex = new RegExp(`\`\`\`json:${fileTag.replace('.', '\\.')}\\n([\\s\\S]*?)\`\`\``, 'i');
  const taggedMatch = raw.match(taggedRegex);
  if (taggedMatch) return taggedMatch[1].trim();
  return '';
};

/**
 * 从后端代码中提取 API 路径摘要（精简版）
 * 只提取路由路径和 HTTP 方法，不传完整代码，大幅减少上下文长度
 */
const extractApiSummary = (backendCode: string): string => {
  const lines = backendCode.split('\n');
  const apiLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配路由定义：router.get('/xxx', ...) 或 router.post('/xxx', ...)
    const routeMatch = trimmed.match(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/i);
    if (routeMatch) {
      apiLines.push(`${routeMatch[1].toUpperCase()} ${routeMatch[2]}`);
      continue;
    }
    // 匹配 Schema 字段定义（提取数据结构）
    const fieldMatch = trimmed.match(/^\s*(\w+)\s*:\s*\{\s*type\s*:\s*(String|Number|Boolean|Date|Schema\.Types\.ObjectId)/);
    if (fieldMatch) {
      apiLines.push(`  字段: ${fieldMatch[1]} (${fieldMatch[2]})`);
    }
  }

  if (apiLines.length === 0) {
    // 降级：截取后端代码的前 2000 字符
    return backendCode.slice(0, 2000) + (backendCode.length > 2000 ? '\n... (已截断)' : '');
  }

  return apiLines.join('\n');
};

/** 合并同类代码块（如多个 model 文件合并为一个） */
const mergeCodeBlocks = (blocks: Array<{ tag: string; content: string }>, pathPrefix: string): string => {
  return blocks
    .filter((b) => b.tag.startsWith(pathPrefix) || b.tag.includes(pathPrefix))
    .map((b) => `// ─── ${b.tag} ───\n${b.content}`)
    .join('\n\n');
};

// =============================================================================
// § 7d-d  全栈 Pipeline 路由  POST /api/vibe/fullstack-pipeline
// =============================================================================

vibeFullStackPipelineRouter.post('/vibe/fullstack-pipeline', async (ctx) => {
  const { prompt, provider = env.activeProvider, modelType = 'text' } = ctx.request.body as Record<string, string>;

  if (!prompt?.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请提供需求描述' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;

  const res = ctx.res;
  // 基础选项（所有步骤共享）
  const baseOpts = { provider, modelType };
  // 编程任务使用低 temperature（更确定性，减少随机错误）
  const codingTemperature = env.pipelineTemperature;
  // 强模型配置（用于前端/质检/编译修复等关键步骤）
  const strongModel = env.pipelineStrongModel || undefined;
  // 轻量步骤选项（Step 1-2：需求分析、数据库设计）
  const lightOpts = { ...baseOpts, temperature: codingTemperature };
  // 重度步骤选项（Step 3-7：后端/前端/UI/质检/编译修复，使用强模型）
  const heavyOpts = { ...baseOpts, temperature: codingTemperature, ...(strongModel ? { model: strongModel } : {}) };

  console.log(`[Pipeline] 启动：provider=${provider}, model=${strongModel || '默认'}, temperature=${codingTemperature}`);

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // SSE 心跳定时器：每 15 秒发送一次心跳，防止连接超时
  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15_000);

  send({ type: 'start' });

  // 上下文长度限制（Ollama 本地模型上下文窗口有限）
  const MAX_ANALYSIS_CHARS = 2000;   // 需求分析最大字符数（精简以减少上下文）
  const MAX_DB_CHARS = 3000;         // 数据库 Schema 最大字符数
  const MAX_BACKEND_CHARS = 4000;    // 后端代码最大字符数
  const MAX_FRONTEND_CHARS = 8000;   // 前端代码最大字符数
  // 不同步骤的超时时间（前端/UI/质检步骤需要更多时间，因为生成量大 + 续写）
  const STEP_TIMEOUT_SHORT = 180_000;  // 分析/数据库/后端：3 分钟
  const STEP_TIMEOUT_LONG = 480_000;   // 前端/UI/质检：8 分钟（生成量大，续写多）
  const STEP_INTERVAL_MS = 2_000;      // 步骤间隔 2 秒

  const stepHeartbeat = () => send({ type: 'heartbeat' });

  /** 创建带进度推送的步骤选项 */
  const TOTAL_STEPS = 7;
  const STEP_ICONS = ['📋', '🗄️', '⚙️', '🎨', '🎯', '🔧', '🧪'];
  /** 步骤 1-3 用短超时，步骤 4-6 用长超时 */
  const getStepTimeout = (step: number) => step <= 3 ? STEP_TIMEOUT_SHORT : STEP_TIMEOUT_LONG;

  const makeStepOpts = (step: number, label: string) => ({
    timeoutMs: getStepTimeout(step),
    onHeartbeat: stepHeartbeat,
    label,
    onProgress: (info: { chars: number; continuations: number }) => {
      send({
        type: 'step',
        step,
        total: TOTAL_STEPS,
        title: info.continuations > 0
          ? `${STEP_ICONS[step - 1] || ''} 续写中（第${info.continuations}次）... 已生成 ${info.chars} 字符`
          : `${STEP_ICONS[step - 1] || ''} 生成中... 已生成 ${info.chars} 字符`,
        status: 'running',
      });
    },
  });

  try {
    const AGENTS = await getFullStackAgents();

    // ── Step 1: 需求分析 ──────────────────────────────────────────────────
    send({ type: 'step', step: 1, total: TOTAL_STEPS, title: '📋 全栈需求分析中...', status: 'running' });

    const analysisResult = await runStep([
      { role: 'system', content: AGENTS.analyst },
      { role: 'user', content: `请分析以下全栈应用需求：\n\n${prompt}` },
    ], lightOpts, makeStepOpts(1, 'Step1-需求分析'));

    send({ type: 'step', step: 1, total: TOTAL_STEPS, title: '📋 需求分析完成', status: 'done', content: analysisResult });

    // 步骤间隔，避免触发 API 限流
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 2: 数据库架构设计 ────────────────────────────────────────────
    send({ type: 'step', step: 2, total: TOTAL_STEPS, title: '🗄️ 数据库架构设计中...', status: 'running' });

    const dbResult = await runStep([
      { role: 'system', content: AGENTS.dbArchitect },
      {
        role: 'user',
        content: `请根据以下需求分析，设计 MongoDB 数据库架构并生成 Mongoose Model 代码。\n\n【原始需求】\n${prompt}\n\n【需求分析】\n${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}`,
      },
    ], lightOpts, makeStepOpts(2, 'Step2-数据库架构'));

    send({ type: 'step', step: 2, total: TOTAL_STEPS, title: '🗄️ 数据库架构完成', status: 'done', content: dbResult });

    // 步骤间隔，避免触发 API 限流
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 3: 后端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 3, total: TOTAL_STEPS, title: '⚙️ 后端代码生成中...', status: 'running' });

    const backendResult = await runStep([
      { role: 'system', content: AGENTS.backend },
      {
        role: 'user',
        content: `请根据以下需求分析和数据库 Schema，生成完整的后端 CRUD 代码。

【原始需求】
${prompt}

【需求分析（摘要）】
${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}

【数据库 Schema】
${truncateText(dbResult, MAX_DB_CHARS)}

【强制要求】
- 每个 CRUD 操作都必须完整实现
- 所有路由必须添加认证中间件
- 密码必须 bcrypt 加密
- 分页 limit 上限 100
- 代码必须完整，不能有 TODO 或省略号`,
      },
    ], heavyOpts, makeStepOpts(3, 'Step3-后端工程'));

    send({ type: 'step', step: 3, total: TOTAL_STEPS, title: '⚙️ 后端代码完成', status: 'done', content: backendResult });

    // 步骤间隔，避免触发 API 限流
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 4: 前端工程 ──────────────────────────────────────────────────
    send({ type: 'step', step: 4, total: TOTAL_STEPS, title: '🎨 前端代码生成中...', status: 'running' });

    const frontendResult = await runStep([
      { role: 'system', content: AGENTS.frontend },
      {
        role: 'user',
        content: `请根据以下需求分析和 API 接口，生成完整的 React 前端代码。

【原始需求】
${prompt}

【需求分析（摘要）】
${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}

【后端 API 路径清单（仅供参考接口路径和数据结构）】
${extractApiSummary(backendResult)}

【⚠️ 最重要的要求 — 使用 CrudPage 工厂模式】
你必须写一个通用的 CrudPage 组件，内置完整的 CRUD 逻辑（列表、搜索、分页、新增、编辑、删除）。
然后每个模块只需传入 columns/fields/apiName 配置即可，不要为每个模块重复写 CRUD 代码！
这是确保所有模块都能完整生成的关键策略。

【强制要求】
1. React 函数组件 + Hooks，原生 CSS 内联样式（禁止 className）
2. 深色主题，export default App
3. 代码必须完整，不能有 TODO 或省略号
4. 禁止 import/require/外部库
5. API 路径：/api/order、/api/product、/api/user 等小写实体名
6. 【极其重要】确保所有括号（圆括号、花括号、方括号）严格配对闭合，括号不匹配会导致编译失败
7. 【空值保护 - 最常见的崩溃原因】
   a. 所有组件 props 必须有默认值：({columns = [], fields = [], data = [], mockData = []}) => ...
   b. 遍历前必须防御：(data || []).map(...) 或 (Array.isArray(x) ? x : []).map(...)
   c. API 响应必须 try-catch + 兜底：try { list = res.data || [] } catch(e) { list = mockData || [] }
   d. 对象属性用可选链：item?.id, item?.name || ''
   e. useState 必须给初始值：useState([]), useState(''), useState(0), useState(false), useState(null)
   f. 绝对禁止直接写 xxx.map() 而不做空值检查，这会导致运行时崩溃
8. 【style 规范】style 属性必须是纯对象（如 style={{ color: 'red', padding: 8 }}），绝对禁止传入数组（如 style={[{}, {}]}），禁止传入字符串。多个样式对象请用展开运算符合并：style={{ ...baseStyle, ...activeStyle }}`,
      },
    ], heavyOpts, makeStepOpts(4, 'Step4-前端工程'));

    send({ type: 'step', step: 4, total: TOTAL_STEPS, title: '🎨 前端代码完成', status: 'done', content: frontendResult });

    // 步骤间隔，避免触发 API 限流
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 5: UI/UX 设计增强 ────────────────────────────────────────────
    send({ type: 'step', step: 5, total: TOTAL_STEPS, title: '🎯 UI/UX 设计增强中...', status: 'running' });

    const MAX_FRONTEND_FOR_UI = 10000; // UI 设计师需要完整的前端代码
    const uiDesignResult = await runStep([
      { role: 'system', content: AGENTS.uiDesigner },
      {
        role: 'user',
        content: `请审查并增强以下 React 前端代码的 UI/UX 设计质量。

【原始需求】
${prompt}

【需求分析（摘要）】
${truncateText(analysisResult, MAX_ANALYSIS_CHARS)}

【当前前端 React 代码】
${truncateText(frontendResult, MAX_FRONTEND_FOR_UI)}

【增强重点】
1. 优化配色方案 — 建立完整的设计 Token 系统
2. 添加微交互动画 — hover、过渡、加载状态
3. 优化布局间距 — 使用 8px 网格系统
4. 增强组件视觉 — 按钮、表格、表单、模态框
5. 添加空状态和加载骨架屏
6. 确保无障碍性 — tabIndex、aria-label、焦点样式

请在原有代码基础上增强，输出完整的增强后代码。`,
      },
    ], heavyOpts, makeStepOpts(5, 'Step5-UI/UX设计'));

    send({ type: 'step', step: 5, total: TOTAL_STEPS, title: '🎯 UI/UX 设计完成', status: 'done', content: uiDesignResult });

    // 提取 UI 增强后的前端代码（优先使用增强版本）
    const enhancedFrontendCode = extractJsxBlock(uiDesignResult) || extractJsxBlock(frontendResult);

    // 步骤间隔，避免触发 API 限流
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 6: 质检整合 ──────────────────────────────────────────────────
    send({ type: 'step', step: 6, total: TOTAL_STEPS, title: '🔧 全栈质检中...', status: 'running' });

    const reviewResult = await runStep([
      { role: 'system', content: AGENTS.reviewer },
      {
        role: 'user',
        content: `请审查并修复以下全栈项目代码：

【数据库 Model 代码】
${truncateText(dbResult, MAX_DB_CHARS)}

【后端路由和 Service 代码】
${truncateText(backendResult, MAX_BACKEND_CHARS)}

【前端 React 代码（已经过 UI/UX 设计师增强）】
${truncateText(enhancedFrontendCode || frontendResult, MAX_FRONTEND_CHARS)}

请按照审查清单逐项检查，修复所有问题后输出完整代码。`,
      },
    ], heavyOpts, makeStepOpts(6, 'Step6-质检整合'));

    send({ type: 'step', step: 6, total: TOTAL_STEPS, title: '🔧 质检完成', status: 'done' });

    // ── 解析质检后的最终代码 ──────────────────────────────────────────────

    // 从质检结果中提取各部分代码
    const taggedBlocks = extractTaggedCodeBlocks(reviewResult);

    // 后端代码提取
    const modelCode = mergeCodeBlocks(taggedBlocks, 'models/') || mergeCodeBlocks(extractTaggedCodeBlocks(dbResult), 'models/');
    const routeCode = mergeCodeBlocks(taggedBlocks, 'routes/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'routes/');
    const serviceCode = mergeCodeBlocks(taggedBlocks, 'services/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'services/');
    const middlewareCode = mergeCodeBlocks(taggedBlocks, 'middleware/') || mergeCodeBlocks(extractTaggedCodeBlocks(backendResult), 'middleware/');
    const envTemplate = taggedBlocks.find((b) => b.tag.includes('.env'))?.content
      || extractTaggedCodeBlocks(backendResult).find((b) => b.tag.includes('.env'))?.content
      || '';

    // 前端代码提取（优先级：质检结果 > UI增强结果 > 原始前端结果）
    let jsxCode = extractJsxBlock(reviewResult) || enhancedFrontendCode || extractJsxBlock(frontendResult);

    // 步骤间隔
    await new Promise(r => setTimeout(r, STEP_INTERVAL_MS));

    // ── Step 7: 编译验证 + AI 自动修复 ────────────────────────────────────
    send({ type: 'step', step: 7, total: TOTAL_STEPS, title: '🧪 编译验证中...', status: 'running' });

    const MAX_COMPILE_FIX_ROUNDS = 3;
    let compileAttempt = 0;
    let lastCompileError = '';

    while (jsxCode && compileAttempt < MAX_COMPILE_FIX_ROUNDS) {
      compileAttempt++;
      send({
        type: 'step', step: 7, total: TOTAL_STEPS,
        title: `🧪 编译验证（第 ${compileAttempt} 轮）...`,
        status: 'running',
      });

      try {
        const compileResult = await compileJsx(jsxCode);

        if (compileResult.success) {
          // 编译成功，跳出循环
          console.log(`[Step7-编译验证] 第 ${compileAttempt} 轮编译成功（${compileResult.compiler}${compileResult.autoFixed ? ', 自动修复括号' : ''}）`);
          send({
            type: 'step', step: 7, total: TOTAL_STEPS,
            title: `🧪 编译通过${compileAttempt > 1 ? `（第 ${compileAttempt} 轮修复后）` : ''}`,
            status: 'done',
          });
          lastCompileError = '';
          break;
        }

        // 编译失败，记录错误
        lastCompileError = compileResult.error || '未知编译错误';
        console.warn(`[Step7-编译验证] 第 ${compileAttempt} 轮编译失败: ${lastCompileError.slice(0, 200)}`);

        // 如果已达最大修复轮数，不再尝试 AI 修复
        if (compileAttempt >= MAX_COMPILE_FIX_ROUNDS) {
          send({
            type: 'step', step: 7, total: TOTAL_STEPS,
            title: `🧪 编译验证完成（${MAX_COMPILE_FIX_ROUNDS} 轮修复后仍有警告，已尽力修复）`,
            status: 'done',
          });
          break;
        }

        // 让 AI 根据编译错误修复代码
        send({
          type: 'step', step: 7, total: TOTAL_STEPS,
          title: `🧪 AI 修复编译错误（第 ${compileAttempt} 轮）...`,
          status: 'running',
        });

        const fixResult = await runStep([
          {
            role: 'system',
            content: `你是一个 JSX/TSX 代码修复专家。你的唯一任务是修复编译错误，不要改变任何业务逻辑。

【修复规则】
1. 只修复编译器报告的错误，不要重构或优化代码
2. 禁止添加 import/require 语句
3. 禁止使用 className（只用 style 内联样式）
4. 确保所有括号（圆括号、花括号、方括号）严格配对
5. 确保 export default 存在
6. 所有 .map()/.filter() 调用前必须有空值防御：(arr || []).map(...)
7. 所有组件 props 必须有默认值：({columns = [], data = []}) => ...
8. 所有 useState 必须有初始值：useState([])、useState('')

【输出格式】
只输出修复后的完整 JSX 代码，用代码块包裹：
\`\`\`jsx
// 修复后的完整代码
\`\`\`
不要输出任何解释文字。`,
          },
          {
            role: 'user',
            content: `以下 JSX 代码编译失败，请修复。

【编译错误信息】
${lastCompileError.slice(0, 1500)}

【需要修复的代码】
\`\`\`jsx
${jsxCode}
\`\`\`

请只修复编译错误，输出完整的修复后代码。`,
          },
        ], heavyOpts, {
          timeoutMs: 300_000, // 修复步骤 5 分钟超时
          onHeartbeat: stepHeartbeat,
          label: `Step7-AI修复(第${compileAttempt}轮)`,
          onProgress: (info) => {
            send({
              type: 'step', step: 7, total: TOTAL_STEPS,
              title: `🧪 AI 修复中... 已生成 ${info.chars} 字符`,
              status: 'running',
            });
          },
        });

        // 从 AI 修复结果中提取 JSX 代码
        const fixedJsx = extractJsxBlock(fixResult);
        if (fixedJsx && fixedJsx.trim().length > 100) {
          jsxCode = fixedJsx;
          console.log(`[Step7-编译验证] AI 修复完成，新代码 ${fixedJsx.length} 字符，进入下一轮编译验证`);
        } else {
          console.warn('[Step7-编译验证] AI 修复结果为空或过短，跳过');
          break;
        }
      } catch (compileErr: any) {
        console.warn(`[Step7-编译验证] 编译/修复异常: ${compileErr?.message}`);
        send({
          type: 'step', step: 7, total: TOTAL_STEPS,
          title: '🧪 编译验证完成（有警告但不影响运行）',
          status: 'done',
        });
        break;
      }
    }

    // 如果没有 JSX 代码，跳过编译验证
    if (!jsxCode) {
      send({
        type: 'step', step: 7, total: TOTAL_STEPS,
        title: '🧪 编译验证跳过（无前端代码）',
        status: 'done',
      });
    }

    // ── 构建最终输出 ──────────────────────────────────────────────────────

    const serverParts = {
      model: modelCode,
      route: routeCode,
      service: serviceCode,
      middleware: middlewareCode,
      envTemplate,
    };

    const dbSchema = {
      collections: modelCode, // Model 代码即为集合定义
      indexes: '',            // 索引已包含在 Model 代码中
      seedData: '',           // 种子数据可后续扩展
    };

    // 前端代码作为 codeParts 返回
    const codeParts = {
      html: '',
      css: '',
      js: '',
      jsx: jsxCode,
      isReact: true,
      isFullHtml: false,
    };

    // ── 质检完成后自动保存到数据库并部署后端 ─────────────────────────────
    let savedAppId: string | undefined;
    let runtimeApiBase: string | undefined;

    try {
      // 从原始 prompt 中提取标题（取前 30 个字符）
      const autoTitle = prompt.trim().slice(0, 30) || '全栈应用';

      // 保存到数据库（isActive: false，不在模板市场展示）
      const savedApp = await VibeTemplate.create({
        title: autoTitle,
        description: `由全栈 Pipeline 自动生成`,
        category: '后台管理',
        author: 'pipeline',
        codeParts,
        isFullStack: true,
        serverParts,
        dbSchema,
        isActive: false,
        publishedAt: new Date(),
      });

      savedAppId = savedApp._id.toString();
      console.log(`✅ Pipeline 自动保存应用: ${savedAppId}`);

      // 自动部署后端（创建动态路由 + Mongoose Model）
      if (serverParts.model) {
        try {
          const deployResult = await deployAppBackend(savedAppId);
          runtimeApiBase = deployResult.basePath;
          console.log(`✅ Pipeline 自动部署后端成功: ${runtimeApiBase}，${deployResult.collections.length} 个集合`);
        } catch (deployErr: any) {
          console.warn(`⚠️ Pipeline 自动部署后端失败（不影响保存）: ${deployErr?.message}`);
        }
      }
    } catch (saveErr: any) {
      console.warn(`⚠️ Pipeline 自动保存失败: ${saveErr?.message}`);
    }

    send({
      type: 'done',
      content: jsxCode ? `\`\`\`jsx\n${jsxCode}\n\`\`\`` : '',
      codeParts,
      serverParts,
      dbSchema,
      analysis: analysisResult,
      isFullStack: true,
      // 新增：返回自动保存和部署的信息
      appId: savedAppId,
      runtimeApiBase,
    });
  } catch (err: any) {
    const errMsg = err?.message || '全栈生成失败，请重试';
    const isTimeout = errMsg.includes('超时');
    send({
      type: 'error',
      message: isTimeout
        ? `${errMsg}。建议：1) 简化需求描述 2) 使用更强的模型 3) 增大 Ollama 上下文窗口（num_ctx）`
        : errMsg,
    });
  } finally {
    clearInterval(heartbeatInterval);
    res.end();
  }
});
