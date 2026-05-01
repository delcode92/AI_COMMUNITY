#!/usr/bin/env python3
"""
Search API server for Cooney
Runs on port 7777
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from ddgs import DDGS

class SearchHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body)
        
        query = data.get('query', '')
        
        if not query:
            self.send_error(400, 'Query required')
            return
        
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=10))
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    port = 7777
    server = HTTPServer(('0.0.0.0', port), SearchHandler)
    print(f'🔍 Search server running on port {port}')
    server.serve_forever()
