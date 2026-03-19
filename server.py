#!/usr/bin/env python3
"""Dev server with Cache-Control: no-store so browsers always fetch fresh modules."""
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8022

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *_):
        pass  # silence request logs

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    httpd.serve_forever()
