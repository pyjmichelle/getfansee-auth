# json-render 快速开始

## 🚀 3 步开始使用

### 步骤 1: 安装依赖

```bash
pnpm add @json-render/core @json-render/react
```

### 步骤 2: 访问示例页面

启动开发服务器：

```bash
pnpm dev
```

然后访问：`http://localhost:3000/ai-dashboard`

### 步骤 3: 测试功能

在输入框中输入提示，例如：

- "创建一个显示收入和订阅者的仪表板"
- "生成一个包含刷新按钮的卡片"

点击"生成"按钮，查看 AI 生成的 UI。

## 📁 已创建的文件

我已经为你创建了以下文件：

1. **`lib/json-render/catalog.ts`** - 定义 AI 可以使用的组件目录
2. **`lib/json-render/registry.tsx`** - 注册组件如何渲染
3. **`app/api/ai/generate/route.ts`** - AI 生成 API 路由（目前是模拟数据）
4. **`app/ai-dashboard/page.tsx`** - 示例页面
5. **`docs/json-render-integration.md`** - 完整集成文档

## 🔧 下一步：连接真实的 AI 服务

当前 API 路由返回的是模拟数据。要连接真实的 AI 服务，你需要：

### 选项 1: 使用 OpenAI

```bash
pnpm add openai
```

然后在 `app/api/ai/generate/route.ts` 中：

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 在 POST 函数中
const systemPrompt = `你是一个 UI 生成助手。用户会描述他们想要的界面，你需要生成符合以下组件目录的 JSON：

${JSON.stringify(catalog, null, 2)}

只使用上述组件，生成符合用户描述的 JSON 结构。`;

const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ],
  stream: true,
});
```

### 选项 2: 使用 Anthropic Claude

```bash
pnpm add @anthropic-ai/sdk
```

## 🎨 自定义组件

### 添加新组件到目录

编辑 `lib/json-render/catalog.ts`：

```typescript
export const catalog = createCatalog({
  components: {
    // ... 现有组件

    // 添加新组件
    Alert: {
      props: z.object({
        title: z.string(),
        message: z.string(),
        variant: z.enum(["info", "warning", "error"]).optional(),
      }),
    },
  },
});
```

### 注册新组件

编辑 `lib/json-render/registry.tsx`：

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const registry: ComponentRegistry = {
  // ... 现有组件

  Alert: ({ element }: any) => (
    <Alert variant={element.props.variant || 'info'}>
      <AlertTitle>{element.props.title}</AlertTitle>
      <AlertDescription>{element.props.message}</AlertDescription>
    </Alert>
  ),
};
```

## 📚 更多信息

查看完整文档：`docs/json-render-integration.md`
