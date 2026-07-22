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
/// The server emits the full callback URL via "oauth_redirect" event, same as start_oauth_server.
#[tauri::command]
async fn start_fixed_oauth_server(window: tauri::Window) -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 54321))
        .map_err(|e| format!("Failed to bind port 54321: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    std::thread::spawn(move || {
        if let Some(Ok(mut stream)) = listener.incoming().next() {
            let mut buf = [0u8; 4096];
            if let Ok(n) = stream.read(&mut buf) {
                let request = String::from_utf8_lossy(&buf[..n]);
                if let Some(path) = request.lines().next().and_then(|l| l.split_whitespace().nth(1)) {
                    let full_url = format!("http://127.0.0.1:{}{}", port, path);
                    let _ = window.emit("oauth_redirect", &full_url);
                }
            }
            let _ = stream.write_all(b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1\r\nContent-Length: 0\r\n\r\n");
        }
    });

    Ok(port)
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
        cancel_oauth_server
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
