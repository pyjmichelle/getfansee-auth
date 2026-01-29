"use client";

import { useState } from "react";
import { DataProvider, ActionProvider, Renderer, useUIStream } from "@json-render/react";
import { registry } from "@/lib/json-render/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 初始数据
const initialData = {
  revenue: 125000,
  growth: 0.15,
  subscribers: 1250,
};

function DashboardContent() {
  const { tree, send, isStreaming } = useUIStream({
    api: "/api/ai/generate",
  });

  const [prompt, setPrompt] = useState("");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Dashboard Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Describe your dashboard, e.g., create a dashboard showing revenue and subscribers"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.trim()) {
                  send(prompt);
                }
              }}
            />
            <Button onClick={() => send(prompt)} disabled={!prompt.trim() || isStreaming}>
              {isStreaming ? "Generating…" : "Generate"}
            </Button>
          </div>

          {tree && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Generated UI</h3>
              <Renderer tree={tree} registry={registry} loading={isStreaming} />
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
      <ActionProvider
        handlers={{
          refresh_data: () => {
            // Refresh data action
            window.location.reload();
          },
          export_report: () => {
            // Export report action - to be implemented
          },
          navigate: (params) => {
            const path = typeof params?.path === "string" ? params.path : null;
            if (path) {
              window.location.href = path;
            }
          },
        }}
      >
        <DashboardContent />
      </ActionProvider>
    </DataProvider>
  );
}
