use std::{
    collections::HashMap,
    env,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Component, Path, PathBuf},
    process::Command,
    thread,
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;

type McpResult<T> = Result<T, String>;

const SAFE_ORBIT_RELATIVE: &str = "Documentos/CerebroProjects";
const BLOCKED_GIT_SUBCOMMANDS: &[&str] = &["push", "pull", "fetch", "remote", "clone"]; // remote operations disabled offline
const ALLOWED_SHELL_COMMANDS: &[&str] = &[
    "ls",
    "cat",
    "tail",
    "pwd",
    "npm",
    "pnpm",
    "yarn",
    "npx",
    "node",
    "deno",
    "cargo",
    "go",
    "python",
    "pip",
    "pip3",
    "just",
    "make",
    "rg",
];
const DEFAULT_SHELL_TIMEOUT_MS: u64 = 60_000;

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    entry_type: String,
    size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    modified_at: Option<u64>,
}

#[derive(Serialize)]
struct ListResponse {
    entries: Vec<FileEntry>,
}

#[derive(Serialize)]
struct ReadResponse {
    path: String,
    encoding: String,
    content: String,
}

#[derive(Serialize)]
struct WriteResponse {
    path: String,
    bytes: usize,
    created: bool,
}

#[derive(Serialize)]
struct ExecResponse {
    command: String,
    args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cwd: Option<String>,
    #[serde(rename = "exitCode")]
    exit_code: i32,
    stdout: String,
    stderr: String,
    #[serde(rename = "durationMs")]
    duration_ms: u128,
}

#[derive(Serialize)]
struct FilesInfoResponse {
    root: String,
    exists: bool,
}

#[derive(Serialize)]
struct ShellCapabilities {
    allowed_commands: Vec<String>,
    #[serde(rename = "defaultTimeoutMs")]
    default_timeout_ms: u64,
}

#[derive(Serialize)]
struct GitInfoResponse {
    version: Option<String>,
    root: String,
}

#[derive(Serialize)]
struct MemoryInfo {
    total: u64,
    used: u64,
    free: u64,
    #[serde(rename = "swapTotal")]
    swap_total: u64,
    #[serde(rename = "swapUsed")]
    swap_used: u64,
}

#[derive(Serialize)]
struct CpuInfo {
    #[serde(rename = "logicalCores")]
    logical_cores: usize,
    #[serde(rename = "globalUsage", skip_serializing_if = "Option::is_none")]
    global_usage: Option<f32>,
}

#[derive(Serialize)]
struct SystemInfoResponse {
    #[serde(rename = "timestampMs")]
    timestamp_ms: u64,
    hostname: Option<String>,
    os: String,
    #[serde(rename = "osVersion", skip_serializing_if = "Option::is_none")]
    os_version: Option<String>,
    #[serde(rename = "kernelVersion", skip_serializing_if = "Option::is_none")]
    kernel_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    architecture: Option<String>,
    memory: MemoryInfo,
    cpu: CpuInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    uptime: Option<u64>,
    #[serde(rename = "processCount", skip_serializing_if = "Option::is_none")]
    process_count: Option<usize>,
}

#[derive(Serialize)]
struct SystemPathsResponse {
    home: String,
    #[serde(rename = "safeOrbit")]
    safe_orbit: String,
}

#[derive(Serialize, Deserialize)]
struct MetricsEntry {
    timestamp: u64,
    mode: String,
    provider: String,
    #[serde(rename = "latencyMs", skip_serializing_if = "Option::is_none")]
    latency_ms: Option<u64>,
    #[serde(rename = "tokensIn", skip_serializing_if = "Option::is_none")]
    tokens_in: Option<u32>,
    #[serde(rename = "tokensOut", skip_serializing_if = "Option::is_none")]
    tokens_out: Option<u32>,
    success: bool,
}

fn safe_root() -> McpResult<PathBuf> {
    let home = resolve_home_dir()?;
    let root = home.join(SAFE_ORBIT_RELATIVE);
    if !root.exists() {
        fs::create_dir_all(&root).map_err(|err| err.to_string())?;
    }
    Ok(root)
}

fn resolve_home_dir() -> McpResult<PathBuf> {
    if let Ok(home) = env::var("HOME") {
        return Ok(PathBuf::from(home));
    }

    if cfg!(target_os = "windows") {
        if let Ok(profile) = env::var("USERPROFILE") {
            return Ok(PathBuf::from(profile));
        }
    }

    Err("No se pudo resolver el directorio home del usuario.".into())
}

fn build_path(root: &Path, input: Option<&str>) -> McpResult<PathBuf> {
    match input {
        Some(value) => sanitize_relative_path(root, Path::new(value)),
        None => Ok(root.to_path_buf()),
    }
}

fn sanitize_relative_path(root: &Path, path: &Path) -> McpResult<PathBuf> {
    if path.is_absolute() {
        let stripped = path
            .strip_prefix(root)
            .map_err(|_| "Ruta fuera de la órbita segura.".to_string())?;
        return sanitize_relative_path(root, stripped);
    }

    let mut resolved = PathBuf::from(root);
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => resolved.push(part),
            Component::ParentDir => {
                if resolved == root {
                    return Err("Ruta fuera de la órbita segura.".into());
                }
                resolved.pop();
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("Ruta inválida".into());
            }
        }
    }

    if !resolved.starts_with(root) {
        return Err("Ruta fuera de la órbita segura.".into());
    }

    Ok(resolved)
}

fn relative_from_root(root: &Path, target: &Path) -> McpResult<String> {
    let relative = target
        .strip_prefix(root)
        .map_err(|_| "Ruta fuera de la órbita segura.".to_string())?;

    if relative.as_os_str().is_empty() {
        Ok(".".to_string())
    } else {
        Ok(relative.to_string_lossy().replace('\\', "/"))
    }
}

fn system_time_to_millis(time: SystemTime) -> Option<u64> {
    time
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn read_hostname() -> Option<String> {
    env::var("HOSTNAME")
        .ok()
        .or_else(|| {
            Command::new("hostname")
                .output()
                .ok()
                .and_then(|output| String::from_utf8(output.stdout).ok())
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
}

fn read_uname(flag: &str) -> Option<String> {
    Command::new("uname")
        .arg(flag)
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn read_linux_meminfo() -> Option<(u64, u64, u64, u64, u64)> {
    if !cfg!(target_os = "linux") {
        return None;
    }

    let contents = fs::read_to_string("/proc/meminfo").ok()?;
    let mut mem_total = 0_u64;
    let mut mem_free = 0_u64;
    let mut mem_available = 0_u64;
    let mut swap_total = 0_u64;
    let mut swap_free = 0_u64;

    for line in contents.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let key = parts[0].trim_end_matches(':');
        let value = parts[1].parse::<u64>().unwrap_or(0) * 1024; // kB -> bytes
        match key {
            "MemTotal" => mem_total = value,
            "MemFree" => mem_free = value,
            "MemAvailable" => mem_available = value,
            "SwapTotal" => swap_total = value,
            "SwapFree" => swap_free = value,
            _ => {}
        }
    }

    if mem_total == 0 {
        return None;
    }

    Some((mem_total, mem_free, mem_available, swap_total, swap_free))
}

fn read_linux_uptime() -> Option<u64> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let contents = fs::read_to_string("/proc/uptime").ok()?;
    let first = contents.split_whitespace().next()?;
    let seconds = first.split('.').next()?.parse::<u64>().ok()?;
    Some(seconds)
}

fn count_linux_processes() -> Option<usize> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let entries = fs::read_dir("/proc").ok()?;
    let mut count = 0_usize;
    for entry in entries {
        if let Ok(dir) = entry {
            if let Some(name) = dir.file_name().to_str() {
                if name.chars().all(|c| c.is_ascii_digit()) {
                    count += 1;
                }
            }
        }
    }
    Some(count)
}

fn metrics_log_path() -> McpResult<PathBuf> {
    let home = resolve_home_dir()?;
    let directory = home.join(".cerebro").join("logs");
    if !directory.exists() {
        fs::create_dir_all(&directory).map_err(|err| err.to_string())?;
    }
    Ok(directory.join("metrics.jsonl"))
}

const BASE64_TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(data: &[u8]) -> String {
    if data.is_empty() {
        return String::new();
    }

    let mut encoded = String::with_capacity(((data.len() + 2) / 3) * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;

        let triple = (b0 << 16) | (b1 << 8) | b2;
        let idx0 = ((triple >> 18) & 0x3F) as usize;
        let idx1 = ((triple >> 12) & 0x3F) as usize;
        let idx2 = ((triple >> 6) & 0x3F) as usize;
        let idx3 = (triple & 0x3F) as usize;

        encoded.push(BASE64_TABLE[idx0] as char);
        encoded.push(BASE64_TABLE[idx1] as char);
        if chunk.len() > 1 {
            encoded.push(BASE64_TABLE[idx2] as char);
        } else {
            encoded.push('=');
        }
        if chunk.len() > 2 {
            encoded.push(BASE64_TABLE[idx3] as char);
        } else {
            encoded.push('=');
        }
    }

    encoded
}

fn decode_base64(input: &str) -> McpResult<Vec<u8>> {
    let cleaned: String = input
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect();

    if cleaned.len() % 4 != 0 {
        return Err("Cadena base64 inválida.".into());
    }

    let mut output = Vec::with_capacity((cleaned.len() / 4) * 3);

    for chunk in cleaned.as_bytes().chunks(4) {
        let mut buffer = [0_u32; 4];
        let mut padding = 0;

        for (index, ch) in chunk.iter().enumerate() {
            if *ch == b'=' {
                buffer[index] = 0;
                padding += 1;
            } else {
                buffer[index] = decode_base64_char(*ch)
                    .ok_or_else(|| "Cadena base64 inválida.".to_string())?;
            }
        }

        let triple = (buffer[0] << 18) | (buffer[1] << 12) | (buffer[2] << 6) | buffer[3];
        output.push(((triple >> 16) & 0xFF) as u8);
        if padding < 2 {
            output.push(((triple >> 8) & 0xFF) as u8);
        }
        if padding < 1 {
            output.push((triple & 0xFF) as u8);
        }
    }

    Ok(output)
}

fn decode_base64_char(byte: u8) -> Option<u32> {
    match byte {
        b'A'..=b'Z' => Some((byte - b'A') as u32),
        b'a'..=b'z' => Some((byte - b'a' + 26) as u32),
        b'0'..=b'9' => Some((byte - b'0' + 52) as u32),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn spawn_command(
    mut cmd: Command,
    command_name: String,
    args: Vec<String>,
    cwd: Option<PathBuf>,
) -> McpResult<ExecResponse> {
    if let Some(ref directory) = cwd {
        cmd.current_dir(directory);
    }

    let start = Instant::now();
    let output = cmd.output().map_err(|err| err.to_string())?;
    let duration = start.elapsed().as_millis();
    let exit_code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let root = safe_root()?;
    let cwd_relative = cwd
        .and_then(|dir| relative_from_root(&root, &dir).ok());

    Ok(ExecResponse {
        command: command_name,
        args,
        cwd: cwd_relative,
        exit_code,
        stdout,
        stderr,
        duration_ms: duration,
    })
}

#[tauri::command]
fn mcp_files_list(path: Option<String>) -> McpResult<ListResponse> {
    let root = safe_root()?;
    let target = build_path(&root, path.as_deref())?;

    if !target.exists() {
        return Err("La ruta indicada no existe.".into());
    }

    if !target.is_dir() {
        return Err("La ruta indicada no es un directorio.".into());
    }

    let mut entries = Vec::new();

    for entry in fs::read_dir(&target).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let metadata = entry.metadata().map_err(|err| err.to_string())?;
        let entry_path = entry.path();
        let entry_relative = relative_from_root(&root, &entry_path)?;
        let modified = metadata.modified().ok().and_then(system_time_to_millis);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry_relative,
            entry_type: if metadata.is_dir() {
                "directory".to_string()
            } else {
                "file".to_string()
            },
            size: if metadata.is_file() { metadata.len() } else { 0 },
            modified_at: modified,
        });
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(ListResponse { entries })
}

#[tauri::command]
fn mcp_files_read(path: String, encoding: Option<String>) -> McpResult<ReadResponse> {
    let root = safe_root()?;
    let target = build_path(&root, Some(path.as_str()))?;

    if !target.exists() {
        return Err("El archivo indicado no existe.".into());
    }

    if !target.is_file() {
        return Err("La ruta indicada no es un archivo.".into());
    }

    let data = fs::read(&target).map_err(|err| err.to_string())?;
    let encoding_pref = encoding.unwrap_or_else(|| "utf8".to_string());
    let content = if encoding_pref.eq_ignore_ascii_case("base64") {
        encode_base64(&data)
    } else {
        String::from_utf8(data)
            .map_err(|_| "El archivo no está codificado como UTF-8. Usa encoding base64.".to_string())?
    };

    let relative = relative_from_root(&root, &target)?;

    Ok(ReadResponse {
        path: relative,
        encoding: if encoding_pref.eq_ignore_ascii_case("base64") {
            "base64".to_string()
        } else {
            "utf8".to_string()
        },
        content,
    })
}

#[tauri::command]
fn mcp_files_write(
    path: String,
    content: String,
    encoding: Option<String>,
    overwrite: Option<bool>,
) -> McpResult<WriteResponse> {
    let root = safe_root()?;
    let target = build_path(&root, Some(path.as_str()))?;

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
    }

    let existed = target.exists();
    if existed && !overwrite.unwrap_or(true) {
        return Err("El archivo ya existe y overwrite=false.".into());
    }

    let encoding_pref = encoding.unwrap_or_else(|| "utf8".to_string());
    let bytes = if encoding_pref.eq_ignore_ascii_case("base64") {
        let payload = decode_base64(&content)?;
        fs::write(&target, &payload).map_err(|err| err.to_string())?;
        payload.len()
    } else {
        fs::write(&target, content.as_bytes()).map_err(|err| err.to_string())?;
        content.as_bytes().len()
    };

    let relative = relative_from_root(&root, &target)?;

    Ok(WriteResponse {
        path: relative,
        bytes,
        created: !existed,
    })
}

#[tauri::command]
fn mcp_files_info() -> McpResult<FilesInfoResponse> {
    let root = safe_root()?;
    Ok(FilesInfoResponse {
        root: root.to_string_lossy().replace('\\', "/"),
        exists: true,
    })
}

#[tauri::command]
fn mcp_git_exec(
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    _timeout_ms: Option<u64>,
) -> McpResult<ExecResponse> {
    if command != "git" && command != "git.exe" {
        return Err("Solo se permite ejecutar el comando git desde este servidor.".into());
    }

    let root = safe_root()?;
    let final_args = args.unwrap_or_default();
    if final_args.is_empty() {
        return Err("Debes especificar un subcomando de git.".into());
    }

    let subcommand = final_args[0].to_lowercase();
    if BLOCKED_GIT_SUBCOMMANDS
        .iter()
        .any(|blocked| blocked.eq_ignore_ascii_case(subcommand.as_str()))
    {
        return Err("Operaciones remotas de git están deshabilitadas en modo offline.".into());
    }

    let working_dir = if let Some(ref dir) = cwd {
        build_path(&root, Some(dir.as_str()))?
    } else {
        root.clone()
    };

    if !working_dir.exists() {
        return Err("El directorio indicado para git no existe.".into());
    }

    let mut cmd = Command::new(command);
    cmd.args(&final_args);
    cmd.current_dir(&working_dir);

    if let Some(env_vars) = env {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    spawn_command(cmd, "git".to_string(), final_args, Some(working_dir))
}

#[tauri::command]
fn mcp_git_info() -> McpResult<GitInfoResponse> {
    let root = safe_root()?;
    let mut cmd = Command::new("git");
    cmd.arg("--version");
    let version = cmd
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|out| out.trim().to_string());

    Ok(GitInfoResponse {
        version,
        root: root.to_string_lossy().replace('\\', "/"),
    })
}

fn is_shell_command_allowed(command: &str) -> bool {
    ALLOWED_SHELL_COMMANDS
        .iter()
        .any(|allowed| allowed.eq_ignore_ascii_case(command))
}

fn has_disallowed_tokens(values: &[String]) -> bool {
    values.iter().any(|value| value.contains('&') || value.contains('|') || value.contains(';'))
}

#[tauri::command]
fn mcp_shell_exec(
    command: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    _timeout_ms: Option<u64>,
) -> McpResult<ExecResponse> {
    if !is_shell_command_allowed(&command) {
        return Err("Comando no permitido por la política de seguridad.".into());
    }

    let final_args = args.unwrap_or_default();
    if has_disallowed_tokens(&final_args) {
        return Err("El comando contiene operadores no permitidos.".into());
    }

    let root = safe_root()?;
    let working_dir = if let Some(ref dir) = cwd {
        build_path(&root, Some(dir.as_str()))?
    } else {
        root.clone()
    };

    if !working_dir.exists() {
        return Err("El directorio indicado no existe.".into());
    }

    let mut cmd = Command::new(&command);
    cmd.args(&final_args);
    cmd.current_dir(&working_dir);

    if let Some(env_vars) = env {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    spawn_command(cmd, command, final_args, Some(working_dir))
}

#[tauri::command]
fn mcp_shell_capabilities() -> McpResult<ShellCapabilities> {
    Ok(ShellCapabilities {
        allowed_commands: ALLOWED_SHELL_COMMANDS
            .iter()
            .map(|value| value.to_string())
            .collect(),
        default_timeout_ms: DEFAULT_SHELL_TIMEOUT_MS,
    })
}

#[tauri::command]
fn mcp_system_info() -> McpResult<SystemInfoResponse> {
    let timestamp_ms = current_timestamp_ms();
    let hostname = read_hostname();
    let os_name = env::consts::OS.to_string();
    let os_version = read_uname("-v");
    let kernel_version = read_uname("-r");
    let architecture = read_uname("-m").or_else(|| Some(env::consts::ARCH.to_string()));

    let cores = thread::available_parallelism().map(|value| value.get()).unwrap_or(0);
    let mut memory = MemoryInfo {
        total: 0,
        used: 0,
        free: 0,
        swap_total: 0,
        swap_used: 0,
    };

    if let Some((total, free, available, swap_total, swap_free)) = read_linux_meminfo() {
        let effective_free = if available > 0 { available } else { free };
        let used = total.saturating_sub(effective_free);
        memory = MemoryInfo {
            total,
            used,
            free: effective_free,
            swap_total,
            swap_used: swap_total.saturating_sub(swap_free),
        };
    }

    let uptime = read_linux_uptime();
    let process_count = count_linux_processes();

    let cpu = CpuInfo {
        logical_cores: cores,
        global_usage: None,
    };

    Ok(SystemInfoResponse {
        timestamp_ms,
        hostname,
        os: os_name,
        os_version,
        kernel_version,
        architecture,
        memory,
        cpu,
        uptime,
        process_count,
    })
}

#[tauri::command]
fn mcp_system_paths() -> McpResult<SystemPathsResponse> {
    let home = resolve_home_dir()?;
    let root = safe_root()?;
    Ok(SystemPathsResponse {
        home: home.to_string_lossy().replace('\\', "/"),
        safe_orbit: root.to_string_lossy().replace('\\', "/"),
    })
}

#[tauri::command]
fn mcp_metrics_append(entry: MetricsEntry) -> McpResult<()> {
    let path = metrics_log_path()?;
    let line = serde_json::to_string(&entry).map_err(|err| err.to_string())?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| err.to_string())?;
    file.write_all(line.as_bytes()).map_err(|err| err.to_string())?;
    file.write_all(b"\n").map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn mcp_metrics_tail(limit: Option<usize>) -> McpResult<Vec<MetricsEntry>> {
    let path = metrics_log_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&path).map_err(|err| err.to_string())?;
    let reader = BufReader::new(file);
    let mut lines: Vec<String> = reader
        .lines()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let keep = limit.unwrap_or(20);
    if lines.len() > keep {
        lines = lines.split_off(lines.len() - keep);
    }

    let mut entries = Vec::with_capacity(lines.len());
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<MetricsEntry>(&line) {
            Ok(entry) => entries.push(entry),
            Err(error) => {
                eprintln!("[metrics] failed to parse entry: {error}");
            }
        }
    }

    Ok(entries)
}

#[tauri::command]
fn mcp_tauri_exec(
    app: tauri::AppHandle,
    command: String,
    args: Option<Vec<String>>,
) -> McpResult<ExecResponse> {
    let mut collected_args = args.unwrap_or_default();
    let start = Instant::now();

    match command.as_str() {
        "show-main-window" => {
            if let Some(window) = app.get_webview_window("main") {
                window.show().map_err(|err| err.to_string())?;
                window.set_focus().map_err(|err| err.to_string())?;
                Ok(ExecResponse {
                    command,
                    args: collected_args,
                    cwd: None,
                    exit_code: 0,
                    stdout: "Ventana principal visible".to_string(),
                    stderr: String::new(),
                    duration_ms: start.elapsed().as_millis(),
                })
            } else {
                Err("No se encontró la ventana principal.".into())
            }
        }
        "toggle-devtools" => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    window.close_devtools();
                } else {
                    window.open_devtools();
                }
                Ok(ExecResponse {
                    command,
                    args: collected_args,
                    cwd: None,
                    exit_code: 0,
                    stdout: "Devtools alternado".to_string(),
                    stderr: String::new(),
                    duration_ms: start.elapsed().as_millis(),
                })
            } else {
                Err("No se encontró la ventana principal.".into())
            }
        }
        "set-always-on-top" => {
            let flag = collected_args.pop().unwrap_or_else(|| "false".into());
            let enabled = flag.eq_ignore_ascii_case("true");
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_always_on_top(enabled)
                    .map_err(|err| err.to_string())?;
                Ok(ExecResponse {
                    command,
                    args: vec![flag],
                    cwd: None,
                    exit_code: 0,
                    stdout: format!("always_on_top={enabled}"),
                    stderr: String::new(),
                    duration_ms: start.elapsed().as_millis(),
                })
            } else {
                Err("No se encontró la ventana principal.".into())
            }
        }
        _ => Err("Comando Tauri no soportado.".into()),
    }
}

#[tauri::command]
fn mcp_tauri_capabilities() -> McpResult<HashMap<&'static str, Vec<&'static str>>> {
    let mut map = HashMap::new();
    map.insert(
        "commands",
        vec!["show-main-window", "toggle-devtools", "set-always-on-top"],
    );
    Ok(map)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            mcp_files_list,
            mcp_files_read,
            mcp_files_write,
            mcp_files_info,
            mcp_git_exec,
            mcp_git_info,
            mcp_shell_exec,
            mcp_shell_capabilities,
            mcp_system_info,
            mcp_system_paths,
            mcp_metrics_append,
            mcp_metrics_tail,
            mcp_tauri_exec,
            mcp_tauri_capabilities
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
