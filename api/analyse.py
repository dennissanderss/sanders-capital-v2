import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            from api._lib.macro_data import get_pair_analysis_data

            query = parse_qs(urlparse(self.path).query)
            pair = query.get("pair", ["EUR/USD"])[0]
            result = get_pair_analysis_data(pair)
            body = json.dumps(result, default=str)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body.encode())
        except Exception as e:
            import traceback
            error_body = json.dumps({"error": str(e), "trace": traceback.format_exc()})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(error_body.encode())
