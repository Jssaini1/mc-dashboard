# MC Dashboard

A desktop dashboard for managing Minecraft servers, built with Tauri v2, React, and TypeScript.

## Features

- **Server Control** — Start, stop, and restart your Minecraft server from a single interface
- **Live Console** — Stream server output in real time with ANSI color stripping, send commands directly
- **Player Tracking** — See who's online with automatic `list` polling
- **Server Metrics** — View uptime, memory configuration, and server status
- **Settings** — Configure server directory, Java path, memory allocation, and auto-start
- **First-Run Setup** — One-click EULA acceptance and `server.properties` generation
- **System Tray** — Minimize to tray, control the server from the context menu
- **Graceful Shutdown** — Server process is automatically stopped when the app closes

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) (platform-specific build tools)
- Java runtime for the Minecraft server

## Development

```bash
# Install dependencies
npm install

# Start the dev server (compiles Rust + launches Vite + opens the app)
npm run tauri dev
```

## Build

```bash
# Build for production
npm run tauri build
```

The installer and standalone executable will be in `src-tauri/target/release/bundle/`.

## Raspberry Pi

The app runs on Raspberry Pi OS (64-bit) and other ARM Debian-based systems. First-time compilation takes 30-60 minutes on a Pi 4.

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
  curl wget build-essential

# Install Node.js (via nvm or nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Build the app
npm install
npm run tauri build
```

The built binary will be in `src-tauri/target/release/bundle/deb/`.

**Performance notes:**
- Pi 4 (4GB) works but is tight — the dashboard uses ~50-80MB, leaving room for a small server
- Pi 4 (8GB) recommended for comfortable headroom
- Paper or Spigot server JARs perform significantly better than vanilla on ARM
- Default memory is set to 512/1024 MB — increase in Settings if you have RAM to spare

## Project Structure

```
src/                        # React frontend
  components/Layout.tsx     # App shell with sidebar navigation
  pages/Status.tsx          # Server overview and controls
  pages/Console.tsx         # Live log stream and command input
  pages/Players.tsx         # Online player list
  pages/Metrics.tsx         # Server metrics and memory
  pages/Settings.tsx        # Configuration form
  hooks/useServerState.ts   # Polling hook for server state
  hooks/useServerLog.ts     # Event subscription for log lines
  lib/server.ts             # Shared types, API wrappers, utilities
src-tauri/                  # Rust backend
  src/lib.rs                # Tauri app builder, tray, shutdown
  src/setup.rs              # EULA and server.properties generation
  src/server/manager.rs     # Process lifecycle, state machine, capture
  src/server/process.rs     # Child process spawn, stdin/stdout handling
  src/server/commands.rs    # Tauri command handlers
  src/server/error.rs       # Typed error types
```

## Tech Stack

- [Tauri v2](https://v2.tauri.app/) — Desktop runtime
- [React 19](https://react.dev/) — UI framework
- [Vite](https://vite.dev/) — Frontend bundler
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first styling
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript

## License

Not yet specified.
