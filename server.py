#!/usr/bin/env python3
import http.server, socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)

with socketserver.TCPServer(('', 8080), NoCacheHandler) as httpd:
    print('Serving on http://localhost:8080  [no-cache]', flush=True)
    httpd.serve_forever()
