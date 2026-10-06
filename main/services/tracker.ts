/**
 * Tracker Service - Weekly project/task tracker data persistence
 *
 * Stores each week's data as a separate JSON file in the app's userData directory.
 * File naming convention: tracker-{weekId}.json (e.g., tracker-2026-W40.json)
 */

import { app, dialog, logger } from "@glaze/core/backend";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TextItem {
  id: string;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  status: "backlog" | "todo" | "doing" | "finished";
  remark?: string;
  tasks: Task[];
  notes: TextItem[];
  painPoints: TextItem[];
}

export interface Person {
  id: string;
  name: string;
  remark?: string;
  projects: Project[];
}

export interface WeekData {
  title?: string;
  transferDismissed?: boolean;
  people: Person[];
}

export interface WeekSummary {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  title?: string;
}

export interface WeekFullEntry {
  weekId: string;
  title?: string;
  weekStart: string;
  weekEnd: string;
  data: WeekData;
}

export interface SaveDialogFilter {
  name: string;
  extensions: string[];
}

// ── Migration ───────────────────────────────────────────────────────

/**
 * Migrate old data formats to current format:
 * - notes/painPoints: string → TextItem[]
 * - status: "partially-finished" → "doing"
 */
function migrateWeekData(data: Record<string, unknown>): void {
  if (!Array.isArray(data.people)) return;

  for (const person of data.people as Record<string, unknown>[]) {
    if (!Array.isArray(person.projects)) continue;

    for (const project of person.projects as Record<string, unknown>[]) {
      // Migrate notes from string to TextItem[]
      if (typeof project.notes === "string") {
        const text = (project.notes as string).trim();
        project.notes = text
          ? text.split("\n").filter((l: string) => l.trim()).map((l: string) => ({
              id: crypto.randomUUID(),
              text: l.trim(),
            }))
          : [];
      }

      // Migrate painPoints from string to TextItem[]
      if (typeof project.painPoints === "string") {
        const text = (project.painPoints as string).trim();
        project.painPoints = text
          ? text.split("\n").filter((l: string) => l.trim()).map((l: string) => ({
              id: crypto.randomUUID(),
              text: l.trim(),
            }))
          : [];
      }

      // Migrate status: "partially-finished" → "doing"
      if (project.status === "partially-finished") {
        project.status = "doing";
      }
    }
  }
}

// ── Validation ───────────────────────────────────────────────────────

const WEEK_ID_REGEX = /^\d{4}-W([0-4]\d|5[0-3])$/;

const VALID_PROJECT_STATUSES = new Set([
  "backlog",
  "todo",
  "doing",
  "finished",
]);

function isValidWeekId(weekId: unknown): weekId is string {
  return typeof weekId === "string" && WEEK_ID_REGEX.test(weekId);
}

function isValidTask(task: unknown): task is Task {
  if (typeof task !== "object" || task === null) return false;
  const t = task as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.text === "string" &&
    typeof t.completed === "boolean"
  );
}

function isValidTextItem(item: unknown): item is TextItem {
  if (typeof item !== "object" || item === null) return false;
  const i = item as Record<string, unknown>;
  return typeof i.id === "string" && typeof i.text === "string";
}

function isValidProject(project: unknown): project is Project {
  if (typeof project !== "object" || project === null) return false;
  const p = project as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.status === "string" &&
    VALID_PROJECT_STATUSES.has(p.status) &&
    Array.isArray(p.tasks) &&
    p.tasks.every(isValidTask) &&
    Array.isArray(p.notes) &&
    p.notes.every(isValidTextItem) &&
    Array.isArray(p.painPoints) &&
    p.painPoints.every(isValidTextItem)
  );
}

function isValidPerson(person: unknown): person is Person {
  if (typeof person !== "object" || person === null) return false;
  const pe = person as Record<string, unknown>;
  return (
    typeof pe.id === "string" &&
    typeof pe.name === "string" &&
    Array.isArray(pe.projects) &&
    pe.projects.every(isValidProject)
  );
}

function isValidWeekData(data: unknown): data is WeekData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.title !== undefined && typeof d.title !== "string") return false;
  return Array.isArray(d.people) && d.people.every(isValidPerson);
}

export interface TemplateData {
  people: string[];
}

export interface BoardTemplate {
  id: string;
  name: string;
  people: string[];
  projects: string[];
}

function isValidTemplateData(data: unknown): data is TemplateData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.people) && d.people.every((p) => typeof p === "string");
}

function isValidBoardTemplate(data: unknown): data is BoardTemplate {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.name === "string" &&
    Array.isArray(d.people) &&
    d.people.every((p: unknown) => typeof p === "string") &&
    Array.isArray(d.projects) &&
    d.projects.every((p: unknown) => typeof p === "string")
  );
}

// ── ISO Week Date Utilities ──────────────────────────────────────────

/**
 * Compute the Monday (start) and Sunday (end) dates for an ISO week.
 * weekId format: "YYYY-Www" (e.g., "2026-W40")
 *
 * Algorithm: Jan 4 is always in ISO week 1. Find the Monday of week 1,
 * then offset by (weekNumber - 1) * 7 days.
 */
function getWeekDateRange(weekId: string): { weekStart: string; weekEnd: string } {
  const year = parseInt(weekId.substring(0, 4), 10);
  const week = parseInt(weekId.substring(6), 10);

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Convert Sunday=0 to 7
  // Monday of ISO week 1
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));

  // Monday of the target week
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

  // Sunday of the target week
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const formatDate = (d: Date): string =>
    d.toISOString().split("T")[0]!;

  return {
    weekStart: formatDate(monday),
    weekEnd: formatDate(sunday),
  };
}

// ── Service ──────────────────────────────────────────────────────────

class TrackerService {
  private dataDir: string | null = null;

  /**
   * Resolve and cache the data directory path.
   * Creates the directory if it does not exist.
   */
  private async getDataDir(): Promise<string> {
    if (this.dataDir) return this.dataDir;

    const userDataPath = await app.getPath("userData");
    this.dataDir = userDataPath;
    await fs.mkdir(this.dataDir, { recursive: true });
    logger.info("tracker-service", "Data directory resolved", {
      path: this.dataDir,
    });
    return this.dataDir;
  }

  /**
   * Build the full file path for a given weekId.
   */
  private async getFilePath(weekId: string): Promise<string> {
    const dir = await this.getDataDir();
    return path.join(dir, `tracker-${weekId}.json`);
  }

  /**
   * Load week data from disk.
   * Returns null if the file does not exist.
   * Automatically migrates old data formats.
   */
  async loadWeek(weekId: string): Promise<WeekData | null> {
    if (!isValidWeekId(weekId)) {
      throw new Error(
        `Invalid weekId format "${weekId}". Expected "YYYY-Www" (e.g., "2026-W40").`
      );
    }

    const filePath = await this.getFilePath(weekId);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      // Apply migration before validation
      if (typeof parsed === "object" && parsed !== null) {
        migrateWeekData(parsed as Record<string, unknown>);
      }

      if (!isValidWeekData(parsed)) {
        logger.warn("tracker-service", "Corrupted week data file, returning null", {
          weekId,
          filePath,
        });
        return null;
      }

      return parsed;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") {
        // File does not exist yet -- not an error
        return null;
      }
      logger.error("tracker-service", "Failed to read week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Failed to load week data for "${weekId}" from ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Save week data to disk. Overwrites any existing file for the weekId.
   */
  async saveWeek(weekId: string, data: WeekData): Promise<void> {
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
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to write week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err),
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
  async listWeeks(): Promise<WeekSummary[]> {
    const dir = await this.getDataDir();
    const filePattern = /^tracker-(\d{4}-W(?:[0-4]\d|5[0-3]))\.json$/;

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to read data directory", {
        dir,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Failed to list weeks from ${dir}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const weeks: WeekSummary[] = [];

    for (const entry of entries) {
      const match = filePattern.exec(entry);
      if (match && match[1]) {
        const weekId = match[1];
        const { weekStart, weekEnd } = getWeekDateRange(weekId);
        // Read title from file
        let title: string | undefined;
        try {
          const raw = await fs.readFile(path.join(dir, entry), "utf-8");
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (typeof parsed.title === "string" && parsed.title.trim()) {
            title = parsed.title;
          }
        } catch {
          // Ignore read errors for title extraction
        }
        weeks.push({ weekId, weekStart, weekEnd, title });
      }
    }

    // Sort newest first: compare weekId strings lexicographically (YYYY-Www sorts correctly)
    weeks.sort((a, b) => b.weekId.localeCompare(a.weekId));

    return weeks;
  }

  /**
   * Load the week template (default people names for new weeks).
   */
  async loadTemplate(): Promise<TemplateData | null> {
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-template.json");

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (!isValidTemplateData(parsed)) {
        logger.warn("tracker-service", "Corrupted template file, returning null", { filePath });
        return null;
      }
      return parsed;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return null;
      }
      logger.error("tracker-service", "Failed to read template file", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Save the week template.
   */
  async saveTemplate(template: TemplateData): Promise<void> {
    if (!isValidTemplateData(template)) {
      throw new Error("Invalid template data structure.");
    }
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-template.json");
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), "utf-8");
  }

  // ── Multi-Template System ───────────────────────────────────────────

  private templatesMigrated = false;

  /**
   * Migrate the old single-template file (tracker-template.json) to the
   * new multi-template file (tracker-templates.json) on first load.
   *
   * Only runs once per service lifetime. If tracker-templates.json already
   * exists, migration is skipped.
   */
  private async migrateOldTemplate(): Promise<boolean> {
    const dir = await this.getDataDir();
    const oldPath = path.join(dir, "tracker-template.json");
    const newPath = path.join(dir, "tracker-templates.json");

    // Check if new file already exists -- skip migration
    try {
      await fs.access(newPath);
      console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "tracker-templates.json already exists" });
      return false;
    } catch {
      // New file does not exist -- check for old file
    }

    // Check if old file exists
    let oldTemplate: TemplateData;
    try {
      const raw = await fs.readFile(oldPath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (!isValidTemplateData(parsed)) {
        console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "old template file is invalid" });
        return false;
      }
      oldTemplate = parsed;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") {
        console.log("[tracker-service:migrateOldTemplate]", { skipped: true, reason: "no old template file found" });
        return false;
      }
      logger.error("tracker-service", "Failed to read old template during migration", {
        oldPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }

    // Perform migration: create a BoardTemplate from the old data
    const migratedTemplate: BoardTemplate = {
      id: crypto.randomUUID(),
      name: "Leadership call",
      people: oldTemplate.people,
      projects: [],
    };

    try {
      await fs.writeFile(newPath, JSON.stringify([migratedTemplate], null, 2), "utf-8");
      console.log("[tracker-service:migrateOldTemplate]", {
        migrated: true,
        templateId: migratedTemplate.id,
        peopleCount: migratedTemplate.people.length,
      });
      return true;
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to write migrated templates file", {
        newPath,
        error: err instanceof Error ? err.message : String(err),
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
  async loadTemplates(): Promise<BoardTemplate[]> {
    // Run migration once per service lifetime
    let migrated = false;
    if (!this.templatesMigrated) {
      migrated = await this.migrateOldTemplate();
      this.templatesMigrated = true;
    }

    const dir = await this.getDataDir();
    const filePath = path.join(dir, "tracker-templates.json");

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        logger.warn("tracker-service", "tracker-templates.json is not an array, returning empty", { filePath });
        console.log("[tracker-service:loadTemplates]", { count: 0, migrated, reason: "file is not an array" });
        return [];
      }

      // Validate each template and filter out invalid entries
      const templates: BoardTemplate[] = [];
      for (const item of parsed) {
        if (isValidBoardTemplate(item)) {
          templates.push(item);
        } else {
          logger.warn("tracker-service", "Skipping invalid board template entry", { item });
        }
      }

      console.log("[tracker-service:loadTemplates]", { count: templates.length, migrated });
      return templates;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") {
        console.log("[tracker-service:loadTemplates]", { count: 0, migrated, reason: "file not found" });
        return [];
      }
      logger.error("tracker-service", "Failed to read templates file", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
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
  async saveTemplates(templates: BoardTemplate[]): Promise<void> {
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
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to write templates file", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
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
  async loadAllWeeks(): Promise<WeekFullEntry[]> {
    const summaries = await this.listWeeks();
    console.log("[tracker-service:loadAllWeeks]", {
      weekCount: summaries.length,
    });

    const results: WeekFullEntry[] = [];

    for (const summary of summaries) {
      try {
        const data = await this.loadWeek(summary.weekId);
        if (data !== null) {
          results.push({
            weekId: summary.weekId,
            title: summary.title,
            weekStart: summary.weekStart,
            weekEnd: summary.weekEnd,
            data,
          });
        } else {
          console.log("[tracker-service:loadAllWeeks]", {
            skipped: summary.weekId,
            reason: "loadWeek returned null (corrupted or invalid)",
          });
        }
      } catch (err: unknown) {
        logger.warn("tracker-service", "Skipping week that failed to load", {
          weekId: summary.weekId,
          error: err instanceof Error ? err.message : String(err),
        });
        console.log("[tracker-service:loadAllWeeks]", {
          skipped: summary.weekId,
          reason: "load error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log("[tracker-service:loadAllWeeks]", {
      loaded: results.length,
      total: summaries.length,
    });

    // Already sorted newest-first from listWeeks()
    return results;
  }

  /**
   * Show a native save dialog and write file data to the chosen path.
   * The data parameter is base64-encoded file content.
   * Returns { success: true, filePath } on success, { success: false } if user cancels.
   */
  async saveExportFile(
    data: string,
    defaultName: string,
    filters: SaveDialogFilter[]
  ): Promise<{ success: boolean; filePath?: string }> {
    console.log("[tracker-service:saveExportFile]", {
      defaultName,
      filterCount: filters.length,
      dataLength: data.length,
    });

    const dialogResult = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters,
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      console.log("[tracker-service:saveExportFile]", {
        result: "canceled by user",
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
        byteCount: buffer.length,
      });
      return { success: true, filePath };
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to write export file", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
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
  async saveAiDatabase(data: string): Promise<{ success: boolean; filePath: string }> {
    const dir = await this.getDataDir();
    const filePath = path.join(dir, "ai-database.json");

    console.log("[tracker-service:saveAiDatabase]", {
      filePath,
      dataLength: data.length,
    });

    try {
      await fs.writeFile(filePath, data, "utf-8");
      console.log("[tracker-service:saveAiDatabase]", {
        result: "saved",
        filePath,
      });
      return { success: true, filePath };
    } catch (err: unknown) {
      logger.error("tracker-service", "Failed to write AI database file", {
        filePath,
        error: err instanceof Error ? err.message : String(err),
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
  async deleteWeek(weekId: string): Promise<boolean> {
    if (!isValidWeekId(weekId)) {
      throw new Error(
        `Invalid weekId format "${weekId}". Expected "YYYY-Www" (e.g., "2026-W40").`
      );
    }

    const filePath = await this.getFilePath(weekId);

    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") {
        // File didn't exist -- still counts as success
        return true;
      }
      logger.error("tracker-service", "Failed to delete week file", {
        weekId,
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(
        `Failed to delete week data for "${weekId}" at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// ── Export singleton ─────────────────────────────────────────────────

export const trackerService = new TrackerService();
