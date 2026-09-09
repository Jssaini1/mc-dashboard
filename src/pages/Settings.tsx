import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { DEFAULT_SETTINGS, loadServerSettings, type ServerSettings } from "../lib/server";

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none disabled:opacity-50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Settings() {
  const [form, setForm] = useState<ServerSettings>({ ...DEFAULT_SETTINGS });
  const [saved, setSaved] = useState(false);
  const [eulaAgreed, setEulaAgreed] = useState(false);
  const [firstRun, setFirstRun] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    loadServerSettings()
      .then(setForm)
      .catch(() => {});
  }, []);

  const minMemoryOk = form.minMemoryMb >= 512;
  const maxMemoryOk = form.maxMemoryMb >= form.minMemoryMb;
  const jarOk = form.serverJar.trim().toLowerCase().endsWith(".jar");
  const valid =
    form.serverDir.trim() !== "" &&
    jarOk &&
    form.javaPath.trim() !== "" &&
    minMemoryOk &&
    maxMemoryOk;

  function set<K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    save();
  }

  async function save() {
    try {
      const store = await load("settings.json", { autoSave: false });
      await store.set("settings", form);
      await store.save();
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  async function pickDirectory() {
    try {
      const dir = await open({ directory: true, multiple: false, title: "Select Server Directory" });
      if (typeof dir === "string") set("serverDir", dir);
    } catch {
      /* cancelled or unavailable */
    }
  }

  async function pickJar() {
    try {
      const file = await open({
        directory: false,
        multiple: false,
        title: "Select Server Jar",
        filters: [{ name: "Server jar", extensions: ["jar"] }],
      });
      if (typeof file === "string") set("serverJar", file.split(/[\\/]/).pop() ?? file);
    } catch {
      /* cancelled or unavailable */
    }
  }

  async function prepareFirstRun() {
    try {
      const dir = form.serverDir.trim();
      const eulaMsg = await invoke<string>("accept_eula", { serverDir: dir });
      const propsMsg = await invoke<string>("ensure_server_properties", { serverDir: dir });
      setFirstRun({ text: `${eulaMsg} | ${propsMsg}`, ok: true });
    } catch (err) {
      setFirstRun({ text: String(err), ok: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <Section title="Server">
        <Field label="Server directory" hint="Folder containing the server files (world, logs, eula.txt)">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.serverDir}
              onChange={(e) => set("serverDir", e.target.value)}
              placeholder="C:\minecraft\server"
            />
            <button
              type="button"
              onClick={pickDirectory}
              title="Browse for a folder"
              className="shrink-0 rounded-md border border-neutral-700 px-3 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Browse
            </button>
          </div>
        </Field>
        <Field label="Server jar" hint="The server jar file inside the directory">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.serverJar}
              onChange={(e) => set("serverJar", e.target.value)}
              placeholder="server.jar"
            />
            <button
              type="button"
              onClick={pickJar}
              title="Choose a server jar file"
              className="shrink-0 rounded-md border border-neutral-700 px-3 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Browse
            </button>
          </div>
        </Field>
        <Field label="Java path" hint="Full path to the java executable">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.javaPath}
              onChange={(e) => set("javaPath", e.target.value)}
              placeholder="C:\Program Files\Java\jdk-21\bin\java.exe"
            />
            <button
              type="button"
              disabled
              title="Enabled in the next step"
              className="shrink-0 rounded-md border border-neutral-700 px-3 text-sm text-neutral-500 disabled:opacity-50"
            >
              Detect
            </button>
          </div>
        </Field>
      </Section>

      <Section title="Memory">
        <div className="flex gap-4">
          <Field label="Min memory (MB)">
            <input
              type="number"
              className={inputClass}
              value={form.minMemoryMb}
              onChange={(e) => set("minMemoryMb", Number(e.target.value))}
            />
          </Field>
          <Field label="Max memory (MB)">
            <input
              type="number"
              className={inputClass}
              value={form.maxMemoryMb}
              onChange={(e) => set("maxMemoryMb", Number(e.target.value))}
            />
          </Field>
        </div>
        {!minMemoryOk && (
          <p className="text-xs text-red-400">Min memory must be at least 512 MB.</p>
        )}
        {!maxMemoryOk && (
          <p className="text-xs text-red-400">Max memory must be at least the min memory.</p>
        )}
      </Section>

      <Section title="Startup">
        <label className="flex items-center gap-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={form.autoStart}
            onChange={(e) => set("autoStart", e.target.checked)}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-900"
          />
          Auto-start the server when the dashboard opens
        </label>
      </Section>

      <Section title="First run">
        <label className="flex items-start gap-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={eulaAgreed}
            onChange={(e) => setEulaAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900"
          />
          <span>
            I agree to the Minecraft End User License Agreement (
            <button
              type="button"
              onClick={() => openUrl("https://aka.ms/MinecraftEULA")}
              className="text-neutral-400 underline hover:text-neutral-200"
            >
              aka.ms/MinecraftEULA
            </button>
            ).
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prepareFirstRun}
            disabled={!eulaAgreed || !valid}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Accept EULA and prepare server files
          </button>
          {firstRun && (
            <span className={firstRun.ok ? "text-xs text-green-400" : "text-xs text-red-400"}>
              {firstRun.text}
            </span>
          )}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save settings
        </button>
        {saved && (
          <span className="text-xs text-green-400">Settings saved.</span>
        )}
      </div>
    </form>
  );
}

export default Settings;
