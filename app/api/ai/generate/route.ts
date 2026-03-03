import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // AI generation endpoint — currently returns a mock response.
    // Production integration with OpenAI/Anthropic is a future milestone (P2).

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
