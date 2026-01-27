import { NextRequest, NextResponse } from "next/server";

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
        title: "Sample Dashboard",
        description: "This is an AI-generated example",
      },
      children: [
        {
          type: "Metric",
          props: {
            label: "Total Revenue",
            valuePath: "/revenue",
            format: "currency",
          },
        },
        {
          type: "Metric",
          props: {
            label: "Growth Rate",
            valuePath: "/growth",
            format: "percent",
          },
        },
        {
          type: "Separator",
        },
        {
          type: "Button",
          props: {
            label: "Refresh Data",
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
        const jsonString = JSON.stringify(mockResponse);
        const chunks = jsonString.match(/.{1,50}/g) || [];

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
