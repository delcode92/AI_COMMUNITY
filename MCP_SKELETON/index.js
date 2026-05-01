const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const server = new Server(
  {
    name: "mcp-skeleton-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "greet",
        description: "Returns a greeting message",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name to greet",
            },
          },
          required: ["name"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params.arguments;

  if (request.params.name === "greet") {
    return {
      content: [
        {
          type: "text",
          text: `Hello, ${name}! Welcome to MCP.`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "skeleton://info",
        name: "MCP Skeleton Info",
        description: "Information about this MCP server",
        mimeType: "text/plain",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "skeleton://info") {
    return {
      contents: [
        {
          type: "text",
          text: "This is the MCP Skeleton Server.\n\nIt provides a simple 'greet' tool that returns a greeting message.\n\nUsage:\n1. Call the 'greet' tool with a 'name' parameter\n2. The server will respond with a friendly greeting",
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${request.params.uri}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Skeleton Server running on stdio");
}

main().catch(console.error);
module.exports = { server, main };