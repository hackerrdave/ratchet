# Ratchet

CLI tool for agentic optimization with high watermarking. Built with Bun + TypeScript.

## Dev

- `bun run src/cli.ts <command>` to run in dev
- `bun run typecheck` for type checking
- `bun run build` to compile to single binary

## Stack

- Bun runtime, prefer `Bun.file` over `node:fs`, `Bun.$` over child_process
- Commander for CLI parsing
- @clack/prompts for interactive flows
- @anthropic-ai/sdk for Claude API
- zod for validation
