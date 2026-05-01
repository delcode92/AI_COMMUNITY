const { spawn } = require('child_process');
const path = require('path');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMCPServer() {
  console.log('Starting MCP server test...\n');

  const serverPath = path.join(__dirname, 'index.js');
  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseBuffer = '';
  let requestId = 1;

  child.stdout.on('data', (data) => {
    responseBuffer += data.toString();
  });

  child.stderr.on('data', (data) => {
    console.error(`[stderr] ${data}`);
  });

  // Wait for server to be ready
  await sleep(500);

  // Test 1: List tools
  console.log('Test 1: Listing tools...');
  const listToolsRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/list"
  };

  child.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  await sleep(200);

  // Test 2: Call greet tool
  console.log('\nTest 2: Calling greet tool...');
  const callToolRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: {
      name: "greet",
      arguments: { name: "Test User" }
    }
  };

  child.stdin.write(JSON.stringify(callToolRequest) + '\n');
  await sleep(200);

  // Test 3: List resources
  console.log('\nTest 3: Listing resources...');
  const listResourcesRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "resources/list"
  };

  child.stdin.write(JSON.stringify(listResourcesRequest) + '\n');
  await sleep(200);

  // Test 4: Read resource
  console.log('\nTest 4: Reading resource...');
  const readResourceRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "resources/read",
    params: {
      uri: "skeleton://info"
    }
  };

  child.stdin.write(JSON.stringify(readResourceRequest) + '\n');
  await sleep(200);

  // Print responses
  console.log('\n=== Responses ===');
  console.log(responseBuffer);

  // Cleanup
  child.kill();
  console.log('\nServer tested and closed.');
}

testMCPServer().catch(console.error);