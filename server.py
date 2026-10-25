#!/usr/bin/env python3
"""
Couple Calendar Local Server
----------------------------
Provides:
1. Static file hosting for the couple calendar app.
2. Real-time synchronization backend via Server-Sent Events (SSE).
3. Local Wi-Fi network sharing so partners can connect from phones / laptops.
"""

import os
import sys
import json
import time
import socket
import threading
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "couple_store.json")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

def offset_date(days):
    t = time.time() + (days * 86400)
    tm = time.localtime(t)
    return f"{tm.tm_year}-{str(tm.tm_mon).zfill(2)}-{str(tm.tm_mday).zfill(2)}"

def get_default_store():
    A = "u_her"  # Anna
    B = "u_you"  # Daniel
    return {
        "couple/profile": {
            "a": {"name": "Anna", "img": ""},
            "b": {"name": "Daniel", "img": ""}
        }
    }

class StoreManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.clients = []
        self.store = self.load()

    def load(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Store] Error reading {DATA_FILE}, using default store: {e}")
        store = get_default_store()
        self.save(store)
        return store

    def save(self, data):
        try:
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Store] Error saving store: {e}")

    def mutate(self, action, path, value, full_store=None):
        with self.lock:
            if full_store and isinstance(full_store, dict):
                self.store = full_store
            else:
                if action == "set" or action == "add":
                    self.store[path] = value
                elif action == "update":
                    current = self.store.get(path, {})
                    if isinstance(current, dict) and isinstance(value, dict):
                        current.update(value)
                        self.store[path] = current
                    else:
                        self.store[path] = value
                elif action == "delete":
                    self.store.pop(path, None)
            self.save(self.store)
            snapshot = dict(self.store)

        self.notify_clients(snapshot)
        return snapshot

    def reset(self):
        with self.lock:
            self.store = get_default_store()
            self.save(self.store)
            snapshot = dict(self.store)
        self.notify_clients(snapshot)
        return snapshot

    def register_client(self, wfile):
        with self.lock:
            self.clients.append(wfile)

    def unregister_client(self, wfile):
        with self.lock:
            if wfile in self.clients:
                self.clients.remove(wfile)

    def notify_clients(self, snapshot):
        msg = f"data: {json.dumps({'type': 'sync', 'store': snapshot})}\n\n".encode("utf-8")
        with self.lock:
            dead_clients = []
            for client in self.clients:
                try:
                    client.write(msg)
                    client.flush()
                except Exception:
                    dead_clients.append(client)
            for dead in dead_clients:
                if dead in self.clients:
                    self.clients.remove(dead)

store_manager = StoreManager()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class CoupleHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS for cross-device/local development
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Serve index.html as root
        if path == "/" or path == "":
            self.path = "/index.html"
            return super().do_GET()

        # API: get current store data
        if path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            with store_manager.lock:
                current = json.dumps(store_manager.store)
            self.wfile.write(current.encode("utf-8"))
            return

        # API: network info & invite URLs
        if path == "/api/info":
            local_ip = get_local_ip()
            info = {
                "port": PORT,
                "local_ip": local_ip,
                "localhost_url": f"http://localhost:{PORT}",
                "network_url": f"http://{local_ip}:{PORT}",
                "partner_a_url": f"http://{local_ip}:{PORT}/?user=a",
                "partner_b_url": f"http://{local_ip}:{PORT}/?user=b",
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(info).encode("utf-8"))
            return

        # API: Server-Sent Events stream for real-time live synchronization
        if path == "/api/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            # Send initial store immediately upon connection
            with store_manager.lock:
                init_msg = f"data: {json.dumps({'type': 'sync', 'store': store_manager.store})}\n\n".encode("utf-8")
            try:
                self.wfile.write(init_msg)
                self.wfile.flush()
            except Exception:
                return

            store_manager.register_client(self.wfile)
            try:
                while True:
                    time.sleep(15)
                    # Keep-alive comment
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                store_manager.unregister_client(self.wfile)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/mutate":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                action = data.get("action", "update")
                p = data.get("path", "")
                val = data.get("value", {})
                full = data.get("store", None)
                updated = store_manager.mutate(action, p, val, full)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "count": len(updated)}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if path == "/api/reset":
            updated = store_manager.reset()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "reset": True}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def run_server():
    local_ip = get_local_ip()
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadingHTTPServer(server_address, CoupleHandler)

    print("\n" + "="*68)
    print(" ❤️   COUPLE CALENDAR SERVER RUNNING")
    print("="*68)
    print(f" 💻 Local Access (This Computer):")
    print(f"    http://localhost:{PORT}")
    print()
    print(f" 📱 Wi-Fi Network Access (For Phones & Partner):")
    print(f"    http://{local_ip}:{PORT}")
    print()
    print(f" 👫 Direct Session Links (Share with Partner):")
    print(f"    Partner 1 (Anna):   http://{local_ip}:{PORT}/?user=a")
    print(f"    Partner 2 (Daniel): http://{local_ip}:{PORT}/?user=b")
    print("="*68)
    print(" Real-time sync: Active (SSE + BroadcastChannel)")
    print(" Press Ctrl+C to stop the server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run_server()
