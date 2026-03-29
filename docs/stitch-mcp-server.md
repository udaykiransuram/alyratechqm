# Stitch MCP Server

This repo now includes a local Stitch companion MCP server:

- Server script: `scripts/stitch-mcp-server.mjs`
- Run command: `npm run mcp:stitch`

## What It Does

This is a project-aware stdio MCP server for homepage design work. It is meant to help Codex or another MCP client inspect the local landing-page files and generate better Stitch-ready prompt packs.

It currently supports these tools:

- `stitch.health`
- `stitch.context_files`
- `stitch.palette_variants`
- `stitch.generate_homepage_brief`
- `stitch.export_homepage_brief`

## What It Does Not Do Yet

This server does not call an official Stitch API by default. It is a local helper layer that prepares design context and prompt packs so the next integration step is cleaner.

## Optional Environment Variables

- `STITCH_API_KEY`
- `STITCH_PROJECT_ID`
- `STITCH_BASE_URL`

These are surfaced through `stitch.health` for visibility, but they are not required for the current local-only workflow.

## Local Run

```bash
npm run mcp:stitch
```

## Example Codex MCP Config

Use your own local project path as `cwd`.

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": [
        "--env-file-if-exists=.env",
        "--env-file-if-exists=.env.local",
        "scripts/stitch-mcp-server.mjs"
      ],
      "cwd": "/Users/udaysuram/Downloads/talent-test-registration"
    }
  }
}
```

A ready-to-copy example is also included at `docs/stitch/codex-mcp.local.json`.

## Recommended Workflow

1. Start the server with `npm run mcp:stitch`.
2. Call `stitch.context_files` to load the homepage context.
3. Call `stitch.palette_variants` if you want visual directions first.
4. Call `stitch.generate_homepage_brief` to produce a Stitch-ready redesign prompt.
5. Call `stitch.export_homepage_brief` to save the prompt pack under `docs/stitch/`.

## Default Export

If you do not pass an `outputPath`, `stitch.export_homepage_brief` writes to:

- `docs/stitch/homepage-brief.json`
