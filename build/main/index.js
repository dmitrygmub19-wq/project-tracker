// main/index.ts
import * as fs3 from "fs";
import * as path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// compat/backend.ts
import { app, BrowserWindow as ElectronBrowserWindow, Menu, ipcMain, dialog, nativeTheme } from "electron";
var BrowserWindow = class extends ElectronBrowserWindow {
  constructor(options = {}) {
    const { id: _id, ...rest } = options;
    super({ ...rest, webPreferences: { contextIsolation: true, nodeIntegration: false, ...rest.webPreferences || {} } });
  }
};
var log = (level, scope, message, data) => {
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[${scope}] ${message}`, data ?? "");
};
var logger = {
  debug: (s, m, d) => log("debug", s, m, d),
  info: (s, m, d) => log("info", s, m, d),
  warn: (s, m, d) => log("warn", s, m, d),
  error: (s, m, d) => log("error", s, m, d)
};

// main/handlers/app.ts
var appHandlers = {
  // Example: Get app information
  getInfo: async () => {
    logger.info("app", "App info requested");
    return {
      name: "My Glaze App",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "production"
    };
  }
  // TODO: Add your app handlers here
  // Example:
  // myMethod: async (params: { arg1: string }) => {
  //   return { result: 'success' };
  // }
};

// main/services/tracker.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
function migrateWeekData(data) {
  if (!Array.isArray(data.people)) return;
  for (const person of data.people) {
    if (!Array.isArray(person.projects)) continue;
    for (const project of person.projects) {
      if (typeof project.notes === "string") {
        const text = project.notes.trim();
        project.notes = text ? text.split("\n").filter((l) => l.trim()).map((l) => ({
          id: crypto.randomUUID(),
          text: l.trim()
        })) : [];
      }
      if (typeof project.painPoints === "string") {
        const text = project.painPoints.trim();
        project.painPoints = text ? text.split("\n").filter((l) => l.trim()).map((l) => ({
          id: crypto.randomUUID(),
          text: l.trim()
        })) : [];
      }
      if (project.status === "partially-finished") {
        project.status = "doing";
      }
    }
  }
}
var WEEK_ID_REGEX = /^\d{4}-W([0-4]\d|5[0-3])$/;
var VALID_PROJECT_STATUSES = /* @__PURE__ */ new Set([
  "backlog",
  "todo",
  "doing",
  "finished"
]);
function isValidWeekId(weekId) {
  return typeof weekId === "string" && WEEK_ID_REGEX.test(weekId);
}
function isValidTask(task) {
  if (typeof task !== "object" || task === null) return false;
  const t = task;
  return typeof t.id === "string" && typeof t.text === "string" && typeof t.completed === "boolean";
}
function isValidTextItem(item) {
  if (typeof item !== "object" || item === null) return false;
  const i = item;
  return typeof i.id === "string" && typeof i.text === "string";
}
function isValidProject(project) {
  if (typeof project !== "object" || project === null) return false;
  const p = project;
  return typeof p.id === "string" && typeof p.name === "string" && typeof p.status === "string" && VALID_PROJECT_STATUSES.has(p.status) && Array.isArray(p.tasks) && p.tasks.every(isValidTask) && Array.isArray(p.notes) && p.notes.every(isValidTextItem) && Array.isArray(p.painPoints) && p.painPoints.every(isValidTextItem);
}
function isValidPerson(person) {
  if (typeof person !== "object" || person === null) return false;
  const pe = person;
  return typeof pe.id === "string" && typeof pe.name === "string" && Array.isArray(pe.projects) && pe.projects.every(isValidProject);
}
function isValidWeekData(data) {
  if (typeof data !== "object" || data === null) return false;
  const d = data;
  if (d.title !== void 0 && typeof d.title !== "string") return false;
  return Array.isArray(d.people) && d.people.every(isValidPerson);
}
function isValidTemplateData(data) {
  if (typeof data !== "object" || data === null) return false;
  const d = data;
  return Array.isArray(d.people) && d.people.every((p) => typeof p === "string");
}
function isValidBoardTemplate(data) {
  if (typeof data !== "object" || data === null) return false;
  const d = data;
  return typeof d.id === "string" && typeof d.name === "string" && Array.isArray(d.people) && d.people.every((p) => typeof p === "string") && Array.isArray(d.projects) && d.projects.every((p) => typeof p === "string");
}
function getWeekDateRange(weekId) {
  const year = parseInt(weekId.substring(0, 4), 10);
  const week = parseInt(weekId.substring(6), 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const formatDate = (d) => d.toISOString().split("T")[0];
  return {
    weekStart: formatDate(monday),
    weekEnd: formatDate(sunday)
  };
}
var TrackerService = class {
  dataDir = null;
  /**
   * Resolve and cache the data directory path.
   * Creates the directory if it does not exist.
   */
  async getDataDir() {
    if (this.dataDir) return this.dataDir;
    const userDataPath = await app.getPath("userData");
    this.dataDir = userDataPath;
    await fs.mkdir(this.dataDir, { recursive: true });
    logger.info("tracker-service", "Data directory resolved", {
      path: this.dataDir
    });
    return this.dataDir;
  }
  /**
   * Build the full file path for a given weekId.
   */
  async getFilePath(weekId) {
    const dir = await this.getDataDir();
    return path.join(dir, `tracker-${weekId}.json`);
  }
  /**
   * Load week data from disk.
   * Returns null if the file does not exist.
   * Automatically migrates old data formats.
   */
  async loadWeek(weekId) {
    if (!isValidWeekId(weekId)) {
      throw new Error(
        `Invalid weekId format "${weekId}". Expected "YYYY-Www" (e.g., "2026-W40").`
      );
    }
    const filePath = await this.getFilePath(weekId);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        migrateWeekData(parsed);
      }
      if (!isValidWeekData(parsed)) {
        logger.warn("tracker-service", "Corrupted week data file, returning null", {
          weekId,
          filePath
        });
        return null;
      }
      return parsed;
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return null;
      }
      logger.error("tracker-service", "Failed to read week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to load week data for "${weekId}" from ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Save week data to disk. Overwrites any existing file for the weekId.
   */
  async saveWeek(weekId, data) {
    if (!isValidWeekId(weekId)) {
      throw new Error(
        `Invalid weekId format "${weekId}". Expected "YYYY-Www" (e.g., "2026-W40").`
      );
    }
    if (!isValidWeekData(data)) {
      throw new Error(
        `Invalid WeekData structure for weekId "${weekId}". Ensure people, projects, and tasks match the expected schema.`
      );
    }
    const filePath = await this.getFilePath(weekId);
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      logger.error("tracker-service", "Failed to write week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to save week data for "${weekId}" to ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * List all stored weeks by scanning the data directory for tracker-*.json files.
   * Returns summaries sorted newest-first.
   */
  async listWeeks() {
    const dir = await this.getDataDir();
    const filePattern = /^tracker-(\d{4}-W(?:[0-4]\d|5[0-3]))\.json$/;
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      logger.error("tracker-service", "Failed to read data directory", {
        dir,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to list weeks from ${dir}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const weeks = [];
    for (const entry of entries) {
      const match = filePattern.exec(entry);
      if (match && match[1]) {
        const weekId = match[1];
        const { weekStart, weekEnd } = getWeekDateRange(weekId);
        let title;
        try {
          const raw = await fs.readFile(path.join(dir, entry), "utf-8");
          const parsed = JSON.parse(raw);
          if (typeof parsed.title === "string" && parsed.title.trim()) {
            title = parsed.title;
          }
        } catch {
        }
        weeks.push({ weekId, weekStart, weekEnd, title });
      }
    }
    weeks.sort((a, b) => b.weekId.localeCompare(a.weekId));
    return weeks;
  }
  /**
   * Load the week template (default people names for new weeks).
   */
  async loadTemplate() {
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-template.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!isValidTemplateData(parsed)) {
        logger.warn("tracker-service", "Corrupted template file, returning null", { filePath });
        return null;
      }
      return parsed;
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return null;
      }
      logger.error("tracker-service", "Failed to read template file", {
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw err;
    }
  }
  /**
   * Save the week template.
   */
  async saveTemplate(template) {
    if (!isValidTemplateData(template)) {
      throw new Error("Invalid template data structure.");
    }
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-template.json");
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), "utf-8");
  }
  // ── Multi-Template System ───────────────────────────────────────────
  templatesMigrated = false;
  /**
   * Migrate the old single-template file (tracker-template.json) to the
   * new multi-template file (tracker-templates.json) on first load.
   *
   * Only runs once per service lifetime. If tracker-templates.json already
   * exists, migration is skipped.
   */
  async migrateOldTemplate() {
    const dir = await this.getDataDir();
    const oldPath = path.join(dir, "tracker-template.json");
    const newPath = path.join(dir, "tracker-templates.json");
    try {
      await fs.access(newPath);
      console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "tracker-templates.json already exists" });
      return false;
    } catch {
    }
    let oldTemplate;
    try {
      const raw = await fs.readFile(oldPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!isValidTemplateData(parsed)) {
        console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "old template file is invalid" });
        return false;
      }
      oldTemplate = parsed;
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "no old template file found" });
        return false;
      }
      logger.error("tracker-service", "Failed to read old template during migration", {
        oldPath,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
    const migratedTemplate = {
      id: crypto.randomUUID(),
      name: "Leadership call",
      people: oldTemplate.people,
      projects: []
    };
    try {
      await fs.writeFile(newPath, JSON.stringify([migratedTemplate], null, 2), "utf-8");
      console.log("[tracker-service:migrateOldTemplate]", {
        migrated: true,
        templateId: migratedTemplate.id,
        peopleCount: migratedTemplate.people.length
      });
      return true;
    } catch (err) {
      logger.error("tracker-service", "Failed to write migrated templates file", {
        newPath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to write migrated templates to ${newPath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Load all board templates from tracker-templates.json.
   * Automatically migrates from the old single-template format on first call.
   * Returns an empty array if the file does not exist.
   */
  async loadTemplates() {
    let migrated = false;
    if (!this.templatesMigrated) {
      migrated = await this.migrateOldTemplate();
      this.templatesMigrated = true;
    }
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-templates.json");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        logger.warn("tracker-service", "tracker-templates.json is not an array, returning empty", { filePath });
        console.log("[tracker-service:loadTemplates]", { count: 0, migrated, reason: "file is not an array" });
        return [];
      }
      const templates = [];
      for (const item of parsed) {
        if (isValidBoardTemplate(item)) {
          templates.push(item);
        } else {
          logger.warn("tracker-service", "Skipping invalid board template entry", { item });
        }
      }
      console.log("[tracker-service:loadTemplates]", { count: templates.length, migrated });
      return templates;
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        console.log("[tracker-service:loadTemplates]", { count: 0, migrated, reason: "file not found" });
        return [];
      }
      logger.error("tracker-service", "Failed to read templates file", {
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to load templates from ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Save the full array of board templates to tracker-templates.json.
   * Validates every template before writing.
   */
  async saveTemplates(templates) {
    if (!Array.isArray(templates)) {
      throw new Error("saveTemplates expects an array of BoardTemplate objects.");
    }
    for (let i = 0; i < templates.length; i++) {
      if (!isValidBoardTemplate(templates[i])) {
        throw new Error(
          `Invalid BoardTemplate at index ${i}. Each template must have id (string), name (string), people (string[]), and projects (string[]).`
        );
      }
    }
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-templates.json");
    try {
      await fs.writeFile(filePath, JSON.stringify(templates, null, 2), "utf-8");
      console.log("[tracker-service:saveTemplates]", { count: templates.length });
    } catch (err) {
      logger.error("tracker-service", "Failed to write templates file", {
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to save templates to ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Load ALL weeks from disk with their full WeekData.
   * Uses listWeeks() to get the week list, then loadWeek() for each.
   * Skips weeks that fail to load (corrupted files).
   * Returns sorted newest-first.
   */
  async loadAllWeeks() {
    const summaries = await this.listWeeks();
    console.log("[tracker-service:loadAllWeeks]", {
      weekCount: summaries.length
    });
    const results = [];
    for (const summary of summaries) {
      try {
        const data = await this.loadWeek(summary.weekId);
        if (data !== null) {
          results.push({
            weekId: summary.weekId,
            title: summary.title,
            weekStart: summary.weekStart,
            weekEnd: summary.weekEnd,
            data
          });
        } else {
          console.log("[tracker-service:loadAllWeeks]", {
            skipped: summary.weekId,
            reason: "loadWeek returned null (corrupted or invalid)"
          });
        }
      } catch (err) {
        logger.warn("tracker-service", "Skipping week that failed to load", {
          weekId: summary.weekId,
          error: err instanceof Error ? err.message : String(err)
        });
        console.log("[tracker-service:loadAllWeeks]", {
          skipped: summary.weekId,
          reason: "load error",
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    console.log("[tracker-service:loadAllWeeks]", {
      loaded: results.length,
      total: summaries.length
    });
    return results;
  }
  /**
   * Show a native save dialog and write file data to the chosen path.
   * The data parameter is base64-encoded file content.
   * Returns { success: true, filePath } on success, { success: false } if user cancels.
   */
  async saveExportFile(data, defaultName, filters) {
    console.log("[tracker-service:saveExportFile]", {
      defaultName,
      filterCount: filters.length,
      dataLength: data.length
    });
    const dialogResult = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters
    });
    if (dialogResult.canceled || !dialogResult.filePath) {
      console.log("[tracker-service:saveExportFile]", {
        result: "canceled by user"
      });
      return { success: false };
    }
    const filePath = dialogResult.filePath;
    try {
      const buffer = Buffer.from(data, "base64");
      await fs.writeFile(filePath, buffer);
      console.log("[tracker-service:saveExportFile]", {
        result: "saved",
        filePath,
        byteCount: buffer.length
      });
      return { success: true, filePath };
    } catch (err) {
      logger.error("tracker-service", "Failed to write export file", {
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to write export file to ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Save aggregated AI database JSON to ai-database.json in the userData directory.
   * The data parameter is a JSON string.
   */
  async saveAiDatabase(data) {
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "ai-database.json");
    console.log("[tracker-service:saveAiDatabase]", {
      filePath,
      dataLength: data.length
    });
    try {
      await fs.writeFile(filePath, data, "utf-8");
      console.log("[tracker-service:saveAiDatabase]", {
        result: "saved",
        filePath
      });
      return { success: true, filePath };
    } catch (err) {
      logger.error("tracker-service", "Failed to write AI database file", {
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to save AI database to ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Delete a week's data file.
   * Returns true if the file was deleted, false if it did not exist.
   */
  async deleteWeek(weekId) {
    if (!isValidWeekId(weekId)) {
      throw new Error(
        `Invalid weekId format "${weekId}". Expected "YYYY-Www" (e.g., "2026-W40").`
      );
    }
    const filePath = await this.getFilePath(weekId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return true;
      }
      logger.error("tracker-service", "Failed to delete week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error(
        `Failed to delete week data for "${weekId}" at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
};
function isNodeError(err) {
  return err instanceof Error && "code" in err;
}
var trackerService = new TrackerService();

// main/handlers/tracker.ts
function isLoadWeekParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.weekId === "string";
}
function isSaveWeekParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.weekId === "string" && typeof p.data === "object" && p.data !== null;
}
function isDeleteWeekParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.weekId === "string";
}
function isSaveTemplateParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.template === "object" && p.template !== null;
}
function isSaveTemplatesParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return Array.isArray(p.templates);
}
function isSaveExportParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.data === "string" && typeof p.defaultName === "string" && Array.isArray(p.filters) && p.filters.every(
    (f) => typeof f === "object" && f !== null && typeof f.name === "string" && Array.isArray(f.extensions) && f.extensions.every(
      (ext) => typeof ext === "string"
    )
  );
}
function isSaveAiDatabaseParams(params) {
  if (typeof params !== "object" || params === null) return false;
  const p = params;
  return typeof p.data === "string";
}
function registerTrackerHandlers() {
  logger.info("tracker", "Registering tracker IPC handlers...");
  ipcMain.handle("tracker:load-week", async (_event, params) => {
    console.log("[tracker:load-week]", { params });
    if (!isLoadWeekParams(params)) {
      logger.error("tracker", "tracker:load-week received invalid params", { params });
      return { data: null };
    }
    try {
      const data = await trackerService.loadWeek(params.weekId);
      console.log("[tracker:load-week]", {
        weekId: params.weekId,
        found: data !== null
      });
      return { data };
    } catch (err) {
      logger.error("tracker", "tracker:load-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err)
      });
      return { data: null };
    }
  });
  ipcMain.handle("tracker:save-week", async (_event, params) => {
    console.log("[tracker:save-week]", {
      params: params && typeof params === "object" ? { weekId: params.weekId, peopleCount: Array.isArray(params.data) ? "invalid" : "object" } : params
    });
    if (!isSaveWeekParams(params)) {
      logger.error("tracker", "tracker:save-week received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params
      });
      return { success: false };
    }
    try {
      await trackerService.saveWeek(params.weekId, params.data);
      console.log("[tracker:save-week]", {
        weekId: params.weekId,
        result: "saved"
      });
      return { success: true };
    } catch (err) {
      logger.error("tracker", "tracker:save-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false };
    }
  });
  ipcMain.handle("tracker:list-weeks", async (_event, params) => {
    console.log("[tracker:list-weeks]", { params });
    try {
      const weeks = await trackerService.listWeeks();
      console.log("[tracker:list-weeks]", {
        result: { weekCount: weeks.length }
      });
      return { weeks };
    } catch (err) {
      logger.error("tracker", "tracker:list-weeks failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { weeks: [] };
    }
  });
  ipcMain.handle("tracker:delete-week", async (_event, params) => {
    console.log("[tracker:delete-week]", { params });
    if (!isDeleteWeekParams(params)) {
      logger.error("tracker", "tracker:delete-week received invalid params", { params });
      return { success: false };
    }
    try {
      const deleted = await trackerService.deleteWeek(params.weekId);
      console.log("[tracker:delete-week]", {
        weekId: params.weekId,
        result: deleted ? "deleted" : "not-found"
      });
      return { success: deleted };
    } catch (err) {
      logger.error("tracker", "tracker:delete-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false };
    }
  });
  ipcMain.handle("tracker:load-template", async (_event, _params) => {
    console.log("[tracker:load-template]");
    try {
      const template = await trackerService.loadTemplate();
      console.log("[tracker:load-template]", { found: template !== null });
      return { template };
    } catch (err) {
      logger.error("tracker", "tracker:load-template failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { template: null };
    }
  });
  ipcMain.handle("tracker:save-template", async (_event, params) => {
    console.log("[tracker:save-template]", { params });
    if (!isSaveTemplateParams(params)) {
      logger.error("tracker", "tracker:save-template received invalid params", { params });
      return { success: false };
    }
    try {
      await trackerService.saveTemplate(params.template);
      console.log("[tracker:save-template]", { result: "saved" });
      return { success: true };
    } catch (err) {
      logger.error("tracker", "tracker:save-template failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false };
    }
  });
  ipcMain.handle("tracker:list-templates", async (_event, _params) => {
    console.log("[tracker:list-templates]", { params: _params });
    try {
      const templates = await trackerService.loadTemplates();
      const templateCount = templates.length;
      console.log("[tracker:list-templates]", { templateCount });
      return { templates };
    } catch (err) {
      logger.error("tracker", "tracker:list-templates failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { templates: [] };
    }
  });
  ipcMain.handle("tracker:save-templates", async (_event, params) => {
    console.log("[tracker:save-templates]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params
    });
    if (!isSaveTemplatesParams(params)) {
      logger.error("tracker", "tracker:save-templates received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params
      });
      return { success: false };
    }
    const templateCount = params.templates.length;
    try {
      await trackerService.saveTemplates(params.templates);
      console.log("[tracker:save-templates]", { templateCount });
      return { success: true };
    } catch (err) {
      logger.error("tracker", "tracker:save-templates failed", {
        templateCount,
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false };
    }
  });
  ipcMain.handle("tracker:load-all-weeks", async (_event, _params) => {
    console.log("[tracker:load-all-weeks]", { params: _params });
    try {
      const weeks = await trackerService.loadAllWeeks();
      console.log("[tracker:load-all-weeks]", {
        result: { weekCount: weeks.length }
      });
      return { weeks };
    } catch (err) {
      logger.error("tracker", "tracker:load-all-weeks failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { weeks: [] };
    }
  });
  ipcMain.handle("tracker:save-export", async (_event, params) => {
    console.log("[tracker:save-export]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      dataLength: params && typeof params === "object" ? String(params.data).length : 0,
      defaultName: params && typeof params === "object" ? params.defaultName : void 0
    });
    if (!isSaveExportParams(params)) {
      logger.error("tracker", "tracker:save-export received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params
      });
      return { success: false };
    }
    try {
      const result = await trackerService.saveExportFile(
        params.data,
        params.defaultName,
        params.filters
      );
      console.log("[tracker:save-export]", {
        result: result.success ? "saved" : "canceled",
        filePath: result.filePath
      });
      return result;
    } catch (err) {
      logger.error("tracker", "tracker:save-export failed", {
        defaultName: params.defaultName,
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false };
    }
  });
  ipcMain.handle("tracker:save-ai-database", async (_event, params) => {
    console.log("[tracker:save-ai-database]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      dataLength: params && typeof params === "object" && typeof params.data === "string" ? params.data.length : 0
    });
    if (!isSaveAiDatabaseParams(params)) {
      logger.error("tracker", "tracker:save-ai-database received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params
      });
      return { success: false, filePath: "" };
    }
    try {
      const result = await trackerService.saveAiDatabase(params.data);
      console.log("[tracker:save-ai-database]", {
        result: "saved",
        filePath: result.filePath
      });
      return result;
    } catch (err) {
      logger.error("tracker", "tracker:save-ai-database failed", {
        error: err instanceof Error ? err.message : String(err)
      });
      return { success: false, filePath: "" };
    }
  });
  logger.info("tracker", "Tracker IPC handlers registered");
}

// main/windows/window-paths.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { fileURLToPath, pathToFileURL } from "url";
var currentFilePath = fileURLToPath(import.meta.url);
var currentDirPath = path2.dirname(currentFilePath);
var BUILD_ROOT = path2.resolve(currentDirPath, "..");
function resolveWindowHtml(htmlFileName) {
  return path2.join(BUILD_ROOT, htmlFileName);
}
function getWindowFileUrl(htmlFileName) {
  return pathToFileURL(resolveWindowHtml(htmlFileName)).toString();
}
function getPreloadPath() {
  return path2.join(BUILD_ROOT, "assets", "preload.cjs");
}
async function getWindowUrl(htmlFileName) {
  const devServerHostFile = path2.join(BUILD_ROOT, "..", ".devserverhost");
  if (fs2.existsSync(devServerHostFile)) {
    try {
      const devServerHost = (await fs2.promises.readFile(devServerHostFile, "utf-8")).trim();
      if (devServerHost) {
        return `${devServerHost}/${htmlFileName}`;
      }
    } catch {
    }
  }
  return getWindowFileUrl(htmlFileName);
}

// main/windows/settings-window.ts
var settingsWindow = null;
async function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    logger.debug("settings", "Settings window already exists, showing it");
    settingsWindow.show();
    return;
  }
  logger.info("settings", "Creating settings window");
  settingsWindow = new BrowserWindow({
    id: "settings",
    width: 520,
    height: 300,
    minWidth: 400,
    minHeight: 200,
    title: "Settings",
    show: false,
    center: true,
    webPreferences: {
      preload: getPreloadPath()
    }
  });
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
  });
  settingsWindow.on("close", () => {
    settingsWindow = null;
  });
  const url = await getWindowUrl("settings-window.html");
  logger.info("settings", "Loading settings URL", { url });
  await settingsWindow.loadURL(url);
}

// main/handlers/index.ts
function registerHandlers() {
  logger.info("handlers", "Registering IPC handlers...");
  ipcMain.handle("app:getInfo", async (_event) => {
    return await appHandlers.getInfo();
  });
  ipcMain.handle("nativeTheme:getInfo", async () => ({ themeSource: nativeTheme.themeSource, shouldUseDarkColors: nativeTheme.shouldUseDarkColors }));
  ipcMain.handle("nativeTheme:setThemeSource", async (_event, source) => {
    nativeTheme.themeSource = source;
    return true;
  });
  ipcMain.handle("nativeTheme:getShouldUseDarkColors", async () => nativeTheme.shouldUseDarkColors);
  ipcMain.handle("nativeTheme:getThemeSource", async () => nativeTheme.themeSource);
  ipcMain.handle("window:openSettings", async (_event) => {
    await openSettingsWindow();
  });
  registerTrackerHandlers();
  logger.info("handlers", "All IPC handlers registered");
}

// main/index.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path3.dirname(__filename);
registerHandlers();
var mainWindow = null;
async function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    logger.debug("main", "Main window already exists, skipping creation");
    return;
  }
  const packageJsonPath = path3.join(__dirname, "..", "..", "package.json");
  const minWindowWidth = 900;
  const minWindowHeight = 600;
  const windowWidth = 1200;
  const windowHeight = 800;
  let windowTitle = "Glaze App";
  try {
    if (fs3.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(await fs3.promises.readFile(packageJsonPath, "utf-8"));
      windowTitle = packageJson.productName || packageJson.appConfig?.displayName || windowTitle;
    }
  } catch {
  }
  const browserWindowStartTime = Date.now();
  logger.info("main", "\u23F1\uFE0F [COLD_START] Creating BrowserWindow", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  mainWindow = new BrowserWindow({
    id: "main",
    // Stable ID for frame persistence
    width: windowWidth,
    height: windowHeight,
    minWidth: minWindowWidth,
    minHeight: minWindowHeight,
    title: windowTitle,
    show: false,
    // Don't show until WebView is ready (prevents flickering)
    webPreferences: {
      preload: getPreloadPath()
    }
  });
  const browserWindowEndTime = Date.now();
  logger.info("main", "\u23F1\uFE0F [COLD_START] BrowserWindow constructor completed", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    duration_ms: browserWindowEndTime - browserWindowStartTime
  });
  mainWindow.once("ready-to-show", () => {
    const showStartTime = Date.now();
    logger.info("main", "\u23F1\uFE0F [COLD_START] ready-to-show event received, showing window", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    mainWindow?.show();
    const showEndTime = Date.now();
    logger.info("main", "\u23F1\uFE0F [COLD_START] Window shown", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      duration_ms: showEndTime - showStartTime
    });
  });
  const url = await getWindowUrl("main-window.html");
  logger.info("main", "Resolved main window URL", { url });
  const loadURLStartTime = Date.now();
  logger.info("main", "\u23F1\uFE0F [COLD_START] Loading URL in window", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url
  });
  await mainWindow.loadURL(url);
  const loadURLEndTime = Date.now();
  logger.info("main", "\u23F1\uFE0F [COLD_START] URL loaded in window (waiting for ready-to-show)", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    duration_ms: loadURLEndTime - loadURLStartTime
  });
}
function setupApplicationMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "App",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings\u2026",
          accelerator: "Command+,",
          click: async () => await openSettingsWindow()
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ]);
  Menu.setApplicationMenu(menu);
  logger.info("main", "Application menu configured with Settings");
}
app.on("window-all-closed", () => {
});
app.on("activate", () => {
  const hasVisibleWindows = BrowserWindow.getAllWindows().some((w) => w.isVisible());
  logger.info("main", "App activate event received", {
    hasVisibleWindows,
    mainWindowExists: !!mainWindow,
    mainWindowDestroyed: mainWindow?.isDestroyed() ?? true
  });
  if (!hasVisibleWindows) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      logger.info("main", "Creating main window due to activate event");
      createMainWindow();
    } else {
      logger.info("main", "Showing existing main window");
      mainWindow.show();
    }
  } else {
    logger.info("main", "Has visible windows, no action needed");
  }
});
app.on("before-quit", () => {
  logger.info("main", "App before-quit, cleaning up...");
});
var startTime = Date.now();
logger.info("main", "\u23F1\uFE0F [COLD_START] Waiting for app ready...", {
  timestamp: (/* @__PURE__ */ new Date()).toISOString()
});
app.whenReady().then(() => {
  const windowCreateStartTime = Date.now();
  logger.info("main", "\u23F1\uFE0F [COLD_START] App ready, creating main window", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    wait_duration_ms: windowCreateStartTime - startTime
  });
  setupApplicationMenu();
  createMainWindow().then(() => {
    const windowCreateEndTime = Date.now();
    logger.info("main", "\u23F1\uFE0F [COLD_START] Main window created successfully", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      duration_ms: windowCreateEndTime - windowCreateStartTime
    });
  }).catch((error) => {
    logger.error("main", "Failed to create main window", error);
  });
});
//# sourceMappingURL=index.js.map
