use tauri::Emitter;
use std::io::{Read, Write};
use std::net::TcpListener;

#[tauri::command]
async fn start_oauth_server(window: tauri::Window) -> Result<u16, String> {
    tauri_plugin_oauth::start(move |url| {
        let _ = window.emit("oauth_redirect", url);
    })
    .map_err(|err| err.to_string())
}

#[tauri::command]
fn cancel_oauth_server(port: u16) -> Result<(), String> {
    tauri_plugin_oauth::cancel(port).map_err(|err| err.to_string())
}

/// Starts a minimal HTTP server on a fixed port (54321) for Supabase OAuth callbacks.
/// Matches the tauri-plugin-oauth pattern: spawn a thread, do all I/O inside it.
#[tauri::command]
fn start_fixed_oauth_server(window: tauri::Window) -> Result<u16, String> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        match TcpListener::bind(("127.0.0.1", 54321)) {
            Ok(listener) => {
                let port = match listener.local_addr() {
                    Ok(addr) => addr.port(),
                    Err(e) => { let _ = tx.send(Err(e.to_string())); return; }
                };
                println!("[FIXED_OAUTH] Listening on 127.0.0.1:{}", port);
                let _ = tx.send(Ok(port));

                for stream in listener.incoming() {
                    match stream {
                        Ok(mut stream) => {
                            let mut buf = [0u8; 4096];
                            if let Ok(n) = stream.read(&mut buf) {
                                let request = String::from_utf8_lossy(&buf[..n]);
                                println!("[FIXED_OAUTH] Request: {} bytes", n);
                                if let Some(line) = request.lines().next() {
                                    if let Some(path) = line.split_whitespace().nth(1) {
                                        let full_url = format!("http://127.0.0.1:{}{}", port, path);
                                        println!("[FIXED_OAUTH] URL: {}", &full_url);
                                        if full_url.contains("?code=") || full_url.contains("&code=") || full_url.contains("?error=") {
                                            println!("[FIXED_OAUTH] Auth code received, emitting event");
                                            let _ = window.emit("oauth_redirect", &full_url);
                                            let _ = stream.write_all(b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1\r\nContent-Length: 0\r\n\r\n");
                                            break;
                                        }
                                    }
                                }
                            }
                            let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK");
                        }
                        Err(e) => {
                            println!("[FIXED_OAUTH] Connection error: {}", e);
                            break;
                        }
                    }
                }
                println!("[FIXED_OAUTH] Server shutting down");
            }
            Err(e) => {
                let _ = tx.send(Err(format!("Failed to bind port 54321: {}", e)));
            }
        }
    });

    rx.recv().map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_oauth::init())
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Warn)
        .build(),
    )
    .setup(|_app| {
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        start_oauth_server,
        cancel_oauth_server,
        start_fixed_oauth_server
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
