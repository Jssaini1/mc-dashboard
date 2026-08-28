import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

export type ServerState = "stopped" | "starting" | "online" | "stopping";

export interface ServerConfig {
  serverDir: string;
  serverJar: string;
  javaPath: string;
  minMemoryMb: number;
  maxMemoryMb: number;
}

export interface ServerSettings extends ServerConfig {
  autoStart: boolean;
}

export const DEFAULT_SETTINGS: ServerSettings = {
  serverDir: "",
  serverJar: "server.jar",
  javaPath: "",
  minMemoryMb: 512,
  maxMemoryMb: 1024,
  autoStart: false,
};

export async function loadServerSettings(): Promise<ServerSettings> {
  try {
    const store = await load("settings.json", { autoSave: false });
    const stored = await store.get<Partial<ServerSettings>>("settings");
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function toServerConfig(settings: ServerSettings): ServerConfig {
  return {
    serverDir: settings.serverDir,
    serverJar: settings.serverJar,
    javaPath: settings.javaPath,
    minMemoryMb: settings.minMemoryMb,
    maxMemoryMb: settings.maxMemoryMb,
  };
}

export function startServer(config: ServerConfig): Promise<string> {
  return invoke<string>("start_server", { config });
}

export function stopServer(): Promise<string> {
  return invoke<string>("stop_server");
}

export function restartServer(config: ServerConfig): Promise<string> {
  return invoke<string>("restart_server", { config });
}

export function sendConsoleCommand(command: string): Promise<string> {
  return invoke<string>("send_console_command", { command });
}

export function getServerState(): Promise<ServerState> {
  return invoke<ServerState>("get_server_state");
}

export interface PlayersResponse {
  count: number;
  max: number;
  names: string[];
}

export interface ServerInfo {
  state: string;
  uptime_secs: number;
  server_dir: string;
  server_jar: string;
  min_memory_mb: number;
  max_memory_mb: number;
}

export function listPlayers(): Promise<PlayersResponse> {
  return invoke<PlayersResponse>("list_players");
}

export function getServerInfo(): Promise<ServerInfo> {
  return invoke<ServerInfo>("get_server_info");
}

const ANSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(line: string): string {
  return line.replace(ANSI_RE, "");
}
