/**
 * Tracker Handlers - IPC handlers for weekly project/task tracker
 *
 * Thin handler layer that validates IPC params and delegates to TrackerService.
 *
 * Channels:
 *   tracker:load-week        - Load a single week's data
 *   tracker:save-week        - Save a week's data
 *   tracker:list-weeks       - List all stored weeks
 *   tracker:delete-week      - Delete a week's data
 *   tracker:load-template    - Load old single template (legacy)
 *   tracker:save-template    - Save old single template (legacy)
 *   tracker:list-templates   - Load all board templates
 *   tracker:save-templates   - Save all board templates
 *   tracker:load-all-weeks   - Load all weeks with full data
 *   tracker:save-export      - Export file via native save dialog
 *   tracker:save-ai-database - Save aggregated AI database JSON
 */

import { ipcMain, logger } from "@glaze/core/backend";
import { trackerService } from "../services/tracker.js";
import type { WeekData, TemplateData, BoardTemplate, SaveDialogFilter } from "../services/tracker.js";

// ── Param Types ──────────────────────────────────────────────────────

interface LoadWeekParams {
  weekId: string;
}

interface SaveWeekParams {
  weekId: string;
  data: WeekData;
}

interface DeleteWeekParams {
  weekId: string;
}

interface SaveTemplateParams {
  template: TemplateData;
}

interface SaveTemplatesParams {
  templates: BoardTemplate[];
}

interface SaveExportParams {
  data: string;
  defaultName: string;
  filters: SaveDialogFilter[];
}

interface SaveAiDatabaseParams {
  data: string;
}

// ── Type Guards ──────────────────────────────────────────────────────

function isLoadWeekParams(params: unknown): params is LoadWeekParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.weekId === "string";
}

function isSaveWeekParams(params: unknown): params is SaveWeekParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.weekId === "string" && typeof p.data === "object" && p.data !== null;
}

function isDeleteWeekParams(params: unknown): params is DeleteWeekParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.weekId === "string";
}

function isSaveTemplateParams(params: unknown): params is SaveTemplateParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.template === "object" && p.template !== null;
}

function isSaveTemplatesParams(params: unknown): params is SaveTemplatesParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return Array.isArray(p.templates);
}

function isSaveExportParams(params: unknown): params is SaveExportParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return (
    typeof p.data === "string" &&
    typeof p.defaultName === "string" &&
    Array.isArray(p.filters) &&
    p.filters.every(
      (f: unknown) =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).name === "string" &&
        Array.isArray((f as Record<string, unknown>).extensions) &&
        ((f as Record<string, unknown>).extensions as unknown[]).every(
          (ext: unknown) => typeof ext === "string"
        )
    )
  );
}

function isSaveAiDatabaseParams(params: unknown): params is SaveAiDatabaseParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.data === "string";
}

// ── Handler Registration ─────────────────────────────────────────────

export function registerTrackerHandlers(): void {
  logger.info("tracker", "Registering tracker IPC handlers...");

  // ── tracker:load-week ──────────────────────────────────────────────
  ipcMain.handle("tracker:load-week", async (_event, params: unknown) => {
    console.log("[tracker:load-week]", { params });

    if (!isLoadWeekParams(params)) {
      logger.error("tracker", "tracker:load-week received invalid params", { params });
      return { data: null };
    }

    try {
      const data = await trackerService.loadWeek(params.weekId);
      console.log("[tracker:load-week]", {
        weekId: params.weekId,
        found: data !== null,
      });
      return { data };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:load-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { data: null };
    }
  });

  // ── tracker:save-week ──────────────────────────────────────────────
  ipcMain.handle("tracker:save-week", async (_event, params: unknown) => {
    console.log("[tracker:save-week]", {
      params: params && typeof params === "object"
        ? { weekId: (params as Record<string, unknown>).weekId, peopleCount: Array.isArray((params as Record<string, unknown>).data) ? "invalid" : "object" }
        : params,
    });

    if (!isSaveWeekParams(params)) {
      logger.error("tracker", "tracker:save-week received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      });
      return { success: false };
    }

    try {
      await trackerService.saveWeek(params.weekId, params.data);
      console.log("[tracker:save-week]", {
        weekId: params.weekId,
        result: "saved",
      });
      return { success: true };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:save-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  });

  // ── tracker:list-weeks ─────────────────────────────────────────────
  ipcMain.handle("tracker:list-weeks", async (_event, params: unknown) => {
    console.log("[tracker:list-weeks]", { params });

    try {
      const weeks = await trackerService.listWeeks();
      console.log("[tracker:list-weeks]", {
        result: { weekCount: weeks.length },
      });
      return { weeks };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:list-weeks failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { weeks: [] };
    }
  });

  // ── tracker:delete-week ────────────────────────────────────────────
  ipcMain.handle("tracker:delete-week", async (_event, params: unknown) => {
    console.log("[tracker:delete-week]", { params });

    if (!isDeleteWeekParams(params)) {
      logger.error("tracker", "tracker:delete-week received invalid params", { params });
      return { success: false };
    }

    try {
      const deleted = await trackerService.deleteWeek(params.weekId);
      console.log("[tracker:delete-week]", {
        weekId: params.weekId,
        result: deleted ? "deleted" : "not-found",
      });
      return { success: deleted };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:delete-week failed", {
        weekId: params.weekId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  });

  // ── tracker:load-template ──────────────────────────────────────────
  ipcMain.handle("tracker:load-template", async (_event, _params: unknown) => {
    console.log("[tracker:load-template]");

    try {
      const template = await trackerService.loadTemplate();
      console.log("[tracker:load-template]", { found: template !== null });
      return { template };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:load-template failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { template: null };
    }
  });

  // ── tracker:save-template ──────────────────────────────────────────
  ipcMain.handle("tracker:save-template", async (_event, params: unknown) => {
    console.log("[tracker:save-template]", { params });

    if (!isSaveTemplateParams(params)) {
      logger.error("tracker", "tracker:save-template received invalid params", { params });
      return { success: false };
    }

    try {
      await trackerService.saveTemplate(params.template);
      console.log("[tracker:save-template]", { result: "saved" });
      return { success: true };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:save-template failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  });

  // ── tracker:list-templates ─────────────────────────────────────────
  ipcMain.handle("tracker:list-templates", async (_event, _params: unknown) => {
    console.log("[tracker:list-templates]", { params: _params });

    try {
      const templates = await trackerService.loadTemplates();
      const templateCount = templates.length;
      console.log("[tracker:list-templates]", { templateCount });
      return { templates };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:list-templates failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { templates: [] };
    }
  });

  // ── tracker:save-templates ──────────────────────────────────────────
  ipcMain.handle("tracker:save-templates", async (_event, params: unknown) => {
    console.log("[tracker:save-templates]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
    });

    if (!isSaveTemplatesParams(params)) {
      logger.error("tracker", "tracker:save-templates received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      });
      return { success: false };
    }

    const templateCount = params.templates.length;

    try {
      await trackerService.saveTemplates(params.templates);
      console.log("[tracker:save-templates]", { templateCount });
      return { success: true };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:save-templates failed", {
        templateCount,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  });

  // ── tracker:load-all-weeks ───────────────────────────────────────────
  ipcMain.handle("tracker:load-all-weeks", async (_event, _params: unknown) => {
    console.log("[tracker:load-all-weeks]", { params: _params });

    try {
      const weeks = await trackerService.loadAllWeeks();
      console.log("[tracker:load-all-weeks]", {
        result: { weekCount: weeks.length },
      });
      return { weeks };
    } catch (err: unknown) {
      logger.error("tracker", "tracker:load-all-weeks failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { weeks: [] };
    }
  });

  // ── tracker:save-export ─────────────────────────────────────────────
  ipcMain.handle("tracker:save-export", async (_event, params: unknown) => {
    console.log("[tracker:save-export]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      dataLength: params && typeof params === "object" ? String((params as Record<string, unknown>).data).length : 0,
      defaultName: params && typeof params === "object" ? (params as Record<string, unknown>).defaultName : undefined,
    });

    if (!isSaveExportParams(params)) {
      logger.error("tracker", "tracker:save-export received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
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
        filePath: result.filePath,
      });
      return result;
    } catch (err: unknown) {
      logger.error("tracker", "tracker:save-export failed", {
        defaultName: params.defaultName,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  });

  // ── tracker:save-ai-database ────────────────────────────────────────
  ipcMain.handle("tracker:save-ai-database", async (_event, params: unknown) => {
    console.log("[tracker:save-ai-database]", {
      receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      dataLength: params && typeof params === "object" && typeof (params as Record<string, unknown>).data === "string"
        ? ((params as Record<string, unknown>).data as string).length
        : 0,
    });

    if (!isSaveAiDatabaseParams(params)) {
      logger.error("tracker", "tracker:save-ai-database received invalid params", {
        receivedKeys: params && typeof params === "object" ? Object.keys(params) : typeof params,
      });
      return { success: false, filePath: "" };
    }

    try {
      const result = await trackerService.saveAiDatabase(params.data);
      console.log("[tracker:save-ai-database]", {
        result: "saved",
        filePath: result.filePath,
      });
      return result;
    } catch (err: unknown) {
      logger.error("tracker", "tracker:save-ai-database failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, filePath: "" };
    }
  });

  logger.info("tracker", "Tracker IPC handlers registered");
}
