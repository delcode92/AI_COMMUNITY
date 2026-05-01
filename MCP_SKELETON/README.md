# MCP Skeleton Server

A simple Model Context Protocol (MCP) server sample.

## Features

- **greet tool**: Returns a friendly greeting message
- **skeleton://info resource**: Provides server information

## Usage

```bash
# Start the server
pnpm run mcp:start

# Development mode (with watch)
pnpm run mcp:dev
```

## Available Tools

### greet

Returns a greeting message.

**Parameters:**
- `name` (string, required): The name to greet

**Example:**
```json
{
  "name": "World"
}
```

## Available Resources

### skeleton://info

Returns information about this MCP server.

## MCP Client Integration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "skeleton": {
      "command": "node",
      "args": ["/path/to/AI_COMMUNITY/MCP_SKELETON/index.js"]
    }
  }
}
```