"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Action } from "@json-render/core";
import {
  useDataValue,
  type ComponentRegistry,
  type ComponentRenderProps,
} from "@json-render/react";

type CardProps = {
  title?: string;
  description?: string;
};

type ButtonProps = {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
  action?: Action;
};

type MetricProps = {
  valuePath: string;
  format?: "currency" | "percent" | "number";
  label: string;
};

type TextProps = {
  variant?: "p" | "h1" | "h2" | "h3" | "h4";
  content: string;
};

type SeparatorProps = {
  orientation?: "horizontal" | "vertical";
};

type BadgeProps = {
  variant?: "default" | "secondary" | "destructive" | "outline";
  label: string;
};

export const registry: ComponentRegistry = {
  Card: ({ element, children }: ComponentRenderProps<CardProps>) => (
    <Card>
      {(element.props.title || element.props.description) && (
        <CardHeader>
          {element.props.title && <CardTitle>{element.props.title}</CardTitle>}
          {element.props.description && (
            <CardDescription>{element.props.description}</CardDescription>
          )}
        </CardHeader>
      )}
      {children && <CardContent>{children}</CardContent>}
    </Card>
  ),

  Button: ({ element, onAction }: ComponentRenderProps<ButtonProps>) => (
    <Button
      variant={element.props.variant || "default"}
      size={element.props.size || "default"}
      onClick={() => {
        const action = element.props.action;
        if (action && onAction) {
          if (action.confirm) {
            const confirmed = window.confirm(
              `${action.confirm.title}\n\n${action.confirm.message}`
            );
            if (confirmed) {
              onAction(action);
            }
          } else {
            onAction(action);
          }
        }
      }}
    >
      {element.props.label}
    </Button>
  ),

  Metric: ({ element }: ComponentRenderProps<MetricProps>) => {
    const value = useDataValue<number>(element.props.valuePath) ?? 0;
    const format = element.props.format || "number";
    const numericValue = typeof value === "number" ? value : Number(value ?? 0);

    let formattedValue: string;
    switch (format) {
      case "currency":
        formattedValue = new Intl.NumberFormat("zh-CN", {
          style: "currency",
          currency: "CNY",
        }).format(numericValue);
        break;
      case "percent":
        formattedValue = `${(numericValue * 100).toFixed(1)}%`;
        break;
      default:
        formattedValue = numericValue.toLocaleString();
    }

    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{element.props.label}</p>
        <p className="text-2xl font-bold">{formattedValue}</p>
      </div>
    );
  },

  Text: ({ element }: ComponentRenderProps<TextProps>) => {
    const Tag = element.props.variant || "p";
    const className =
      Tag === "h1"
        ? "text-4xl font-bold"
        : Tag === "h2"
          ? "text-3xl font-semibold"
          : Tag === "h3"
            ? "text-2xl font-semibold"
            : Tag === "h4"
              ? "text-xl font-semibold"
              : "";
    return <Tag className={cn(className)}>{element.props.content}</Tag>;
  },

  Separator: ({ element }: ComponentRenderProps<SeparatorProps>) => (
    <Separator orientation={element.props.orientation || "horizontal"} />
  ),

  Badge: ({ element }: ComponentRenderProps<BadgeProps>) => (
    <Badge variant={element.props.variant || "default"}>{element.props.label}</Badge>
  ),
};
