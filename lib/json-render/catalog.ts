import { createCatalog } from "@json-render/core";
import { z } from "zod";

// 定义操作模式（AI 可以声明的操作）
const ActionSchema = z.object({
  name: z.string(),
  params: z.record(z.any()).optional(),
  confirm: z
    .object({
      title: z.string(),
      message: z.string(),
      variant: z.enum(["default", "destructive"]).optional(),
    })
    .optional(),
  onSuccess: z.any().optional(),
  onError: z.any().optional(),
});

export const catalog = createCatalog({
  components: {
    // Card 组件
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      hasChildren: true,
    },

    // Button 组件
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "outline", "ghost", "destructive", "secondary"]).optional(),
        size: z.enum(["default", "sm", "lg"]).optional(),
        action: ActionSchema.optional(),
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
        variant: z.enum(["p", "h1", "h2", "h3", "h4"]).optional(),
      }),
    },

    // Separator 组件
    Separator: {
      props: z.object({
        orientation: z.enum(["horizontal", "vertical"]).optional(),
      }),
    },

    // Badge 组件
    Badge: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
      }),
    },
  },

  // 定义可用的操作
  actions: {
    export_report: { description: "Export report as PDF" },
    refresh_data: { description: "Refresh all data" },
    navigate: { description: "Navigate to specified page" },
    delete: { description: "Delete item" },
    save: { description: "Save data" },
  },
});
