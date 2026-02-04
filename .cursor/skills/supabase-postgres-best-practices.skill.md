---
name: supabase-postgres-best-practices
description: Best practices for working with Supabase and PostgreSQL. Use when writing database queries, designing schemas, or optimizing database performance.
metadata:
  author: community
  version: "1.0.0"
---

# Supabase & PostgreSQL Best Practices

Guidelines for efficient and secure database operations with Supabase.

## When to Apply

- Writing database queries
- Designing database schemas
- Implementing Row Level Security (RLS)
- Optimizing query performance
- Managing database migrations
- Working with Supabase client libraries

## Key Principles

- Always use RLS policies for security
- Use indexes for frequently queried columns
- Minimize data transferred in queries
- Use prepared statements and parameterized queries
- Implement proper error handling
- Use transactions for multi-step operations
- Optimize joins and avoid N+1 queries
- Use connection pooling appropriately
