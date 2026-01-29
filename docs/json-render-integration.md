# json-render 集成指南

## 📦 什么是 json-render？

json-render 是一个让 AI 生成 JSON，然后安全地渲染成 UI 的库。它提供了：

- **约束性** - AI 只能使用你定义的组件目录
- **可预测性** - JSON 输出始终符合你的模式
- **快速** - 支持流式渲染，模型响应时即可显示

## 🚀 安装

```bash
pnpm add @json-render/core @json-render/react zod
```

注意：你的项目已经安装了 `zod`，所以只需要安装前两个包。

## 📚 核心概念

### 1. Catalog（组件目录）

定义 AI 可以使用哪些组件，以及它们的属性模式。

### 2. Registry（组件注册表）

定义如何将 JSON 元素渲染成实际的 React 组件。

### 3. UI Stream

接收 AI 生成的 JSON 并实时渲染。

## 🎯 集成步骤

### 步骤 1: 定义组件目录

创建 `lib/json-render/catalog.ts`：

```typescript
import { createCatalog } from "@json-render/core";
import { z } from "zod";

// 定义操作模式（AI 可以声明的操作）
const ActionSchema = z.object({
  name: z.string(),
  params: z.record(z.any()).optional(),
});

export const catalog = createCatalog({
  components: {
    // Card 组件
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      hasChildren: true, // 支持子元素
    },

    // Button 组件
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "outline", "ghost", "destructive"]).optional(),
        size: z.enum(["default", "sm", "lg"]).optional(),
        action: ActionSchema.optional(), // AI 可以声明操作意图
      }),
    },

    // Metric 组件（用于显示指标）
    Metric: {
      props: z.object({
        label: z.string(),
        valuePath: z.string(), // 绑定到数据路径，如 "/revenue"
        format: z.enum(["currency", "percent", "number"]).optional(),
      }),
    },

    // Text 组件
    Text: {
      props: z.object({
        content: z.string(),
        variant: z.enum(["p", "h1", "h2", "h3"]).optional(),
      }),
    },
  },

  // 定义可用的操作
  actions: {
    export_report: { description: "导出报告为 PDF" },
    refresh_data: { description: "刷新所有数据" },
    navigate: { description: "导航到指定页面" },
  },
});
```

### 步骤 2: 创建组件注册表

创建 `lib/json-render/registry.tsx`：

```typescript
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 定义组件注册表类型
export type ComponentRegistry = {
  [key: string]: React.ComponentType<any>;
};

// 创建组件注册表
export const registry: ComponentRegistry = {
  Card: ({ element, children }: any) => (
    <Card>
      {element.props.title && (
        <CardHeader>
          <CardTitle>{element.props.title}</CardTitle>
          {element.props.description && (
            <CardDescription>{element.props.description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  ),

  Button: ({ element, onAction }: any) => (
    <Button
      variant={element.props.variant || 'default'}
      size={element.props.size || 'default'}
      onClick={() => {
        if (element.props.action && onAction) {
          onAction(element.props.action);
        }
      }}
    >
      {element.props.label}
    </Button>
  ),

  Metric: ({ element, data }: any) => {
    // 从数据路径获取值
    const getValue = (path: string) => {
      const keys = path.split('/').filter(Boolean);
      let value = data;
      for (const key of keys) {
        value = value?.[key];
      }
      return value ?? 0;
    };

    const value = getValue(element.props.valuePath);
    const format = element.props.format || 'number';

    let formattedValue: string;
    switch (format) {
      case 'currency':
        formattedValue = new Intl.NumberFormat('zh-CN', {
          style: 'currency',
          currency: 'CNY',
        }).format(value);
        break;
      case 'percent':
        formattedValue = `${(value * 100).toFixed(1)}%`;
        break;
      default:
        formattedValue = value.toLocaleString();
    }

    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{element.props.label}</p>
        <p className="text-2xl font-bold">{formattedValue}</p>
      </div>
    );
  },

  Text: ({ element }: any) => {
    const Tag = element.props.variant || 'p';
    return <Tag>{element.props.content}</Tag>;
  },
};
```

### 步骤 3: 创建 API 路由

创建 `app/api/ai/generate/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/json-render/catalog";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // TODO: 这里调用你的 AI 服务（OpenAI, Anthropic, 等）
    // 使用 catalog 来约束 AI 的输出

    // 示例：模拟 AI 响应
    // 实际使用时，你需要：
    // 1. 调用 AI API（OpenAI, Anthropic, 等）
    // 2. 在 prompt 中包含 catalog 信息
    // 3. 使用 streaming 返回结果

    const mockResponse = {
      type: "Card",
      props: {
        title: "示例仪表板",
        description: "这是由 AI 生成的示例",
      },
      children: [
        {
          type: "Metric",
          props: {
            label: "总收入",
            valuePath: "/revenue",
            format: "currency",
          },
        },
        {
          type: "Button",
          props: {
            label: "刷新数据",
            action: {
              name: "refresh_data",
            },
          },
        },
      ],
    };

    // 返回流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 模拟流式输出
        const chunks = JSON.stringify(mockResponse).match(/.{1,50}/g) || [];
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### 步骤 4: 创建示例页面

创建 `app/ai-dashboard/page.tsx`：

```typescript
'use client';

import { useState } from 'react';
import { DataProvider, ActionProvider, Renderer, useUIStream } from '@json-render/react';
import { registry } from '@/lib/json-render/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 初始数据
const initialData = {
  revenue: 125000,
  growth: 0.15,
  subscribers: 1250,
};

function DashboardContent() {
  const { tree, send, isLoading } = useUIStream({
    api: '/api/ai/generate',
  });

  const [prompt, setPrompt] = useState('');

  const handleAction = (action: any) => {
    console.log('Action triggered:', action);

    switch (action.name) {
      case 'refresh_data':
        // 刷新数据的逻辑
        window.location.reload();
        break;
      case 'export_report':
        // 导出报告的逻辑
        alert('导出报告功能待实现');
        break;
      case 'navigate':
        // 导航逻辑
        if (action.params?.path) {
          window.location.href = action.params.path;
        }
        break;
      default:
        console.warn('Unknown action:', action);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI 仪表板生成器</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="描述你想要的仪表板，例如：创建一个显示收入和订阅者的仪表板"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && prompt.trim()) {
                  send(prompt);
                }
              }}
            />
            <Button
              onClick={() => send(prompt)}
              disabled={!prompt.trim() || isLoading}
            >
              {isLoading ? '生成中...' : '生成'}
            </Button>
          </div>

          {tree && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">生成的 UI：</h3>
              <Renderer
                tree={tree}
                components={registry}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AIDashboardPage() {
  return (
    <DataProvider initialData={initialData}>
      <ActionProvider actions={{
        refresh_data: () => {
          console.log('Refreshing data...');
        },
        export_report: () => {
          console.log('Exporting report...');
        },
        navigate: (params: any) => {
          console.log('Navigating to:', params);
        },
      }}>
        <DashboardContent />
      </ActionProvider>
    </DataProvider>
  );
}
```

## 🔧 与现有组件集成

### 集成 shadcn/ui 组件

你的项目已经有很多 shadcn/ui 组件，可以轻松集成到 json-render：

```typescript
// 在 catalog.ts 中添加更多组件
export const catalog = createCatalog({
  components: {
    // ... 现有组件

    // 添加 Dialog
    Dialog: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
        trigger: z.string(), // 触发按钮文本
      }),
      hasChildren: true,
    },

    // 添加 Tabs
    Tabs: {
      props: z.object({
        defaultValue: z.string().optional(),
      }),
      hasChildren: true,
    },

    Tab: {
      props: z.object({
        value: z.string(),
        label: z.string(),
      }),
      hasChildren: true,
    },
  },
});

// 在 registry.tsx 中注册
export const registry = {
  // ... 现有组件

  Dialog: ({ element, children }: any) => {
    const [open, setOpen] = useState(false);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>{element.props.trigger}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{element.props.title}</DialogTitle>
            {element.props.description && (
              <DialogDescription>{element.props.description}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  },
};
```

## 🎨 高级功能

### 条件可见性

```typescript
// AI 可以生成带条件可见性的组件
{
  "type": "Alert",
  "props": { "message": "错误发生" },
  "visible": {
    "and": [
      { "path": "/form/hasError" },
      { "not": { "path": "/form/errorDismissed" } }
    ]
  }
}
```

### 数据绑定

```typescript
// 使用 valuePath 绑定数据
{
  "type": "Metric",
  "props": {
    "label": "订阅者",
    "valuePath": "/subscribers", // 从 DataProvider 的数据中获取
    "format": "number"
  }
}
```

### 操作确认

```typescript
{
  "type": "Button",
  "props": {
    "label": "删除",
    "action": {
      "name": "delete",
      "confirm": {
        "title": "确认删除",
        "message": "确定要删除吗？",
        "variant": "destructive"
      }
    }
  }
}
```

## 📝 实际 AI 集成示例

如果你使用 OpenAI：

```typescript
// app/api/ai/generate/route.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  // 构建系统提示，包含 catalog 信息
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

  // 返回流式响应
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          controller.enqueue(encoder.encode(`data: ${content}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## ✅ 检查清单

- [ ] 安装 `@json-render/core` 和 `@json-render/react`
- [ ] 创建 `lib/json-render/catalog.ts` 定义组件目录
- [ ] 创建 `lib/json-render/registry.tsx` 注册组件
- [ ] 创建 `app/api/ai/generate/route.ts` API 路由
- [ ] 创建示例页面测试功能
- [ ] 集成现有的 shadcn/ui 组件
- [ ] 配置 AI 服务（OpenAI/Anthropic 等）
- [ ] 测试流式渲染
- [ ] 测试操作处理

## 🚀 下一步

1. **安装包**：运行 `pnpm add @json-render/core @json-render/react`
2. **创建文件**：按照上述步骤创建必要的文件
3. **测试**：访问 `/ai-dashboard` 页面测试功能
4. **扩展**：添加更多组件到 catalog 和 registry
5. **集成 AI**：连接真实的 AI 服务（OpenAI, Anthropic 等）

## 📚 参考资源

- [json-render GitHub](https://github.com/vercel-labs/json-render)
- [json-render 文档](https://json-render.dev)
