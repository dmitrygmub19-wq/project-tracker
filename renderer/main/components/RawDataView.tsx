import { useState, useCallback } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  DatabaseIcon,
  TableIcon,
  CheckIcon,
  MinusIcon,
} from "lucide-react";
import {
  Button,
  ScrollArea,
  Toolbar,
  ToolbarContent,
  ToolbarActions,
  ToolbarTitle,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TabsRoot,
  Tabs,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  Checkbox,
  EmptyState,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateMedia,
} from "@glaze/core/components";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type {
  WeekData,
  ProjectStatus,
} from "../types";

// --- Types ---

interface AllWeeksResponse {
  weeks: Array<{
    weekId: string;
    title?: string;
    weekStart: string;
    weekEnd: string;
    data: WeekData;
  }>;
}

interface WeekEntry {
  weekId: string;
  title?: string;
  weekStart: string;
  weekEnd: string;
  data: WeekData;
}

interface TaskRow {
  taskName: string;
  project: string;
  person: string;
  weekId: string;
  week: string;
  status: boolean;
}

interface ProjectRow {
  person: string;
  project: string;
  weekId: string;
  week: string;
  status: string;
}

interface NoteRow {
  week: string;
  person: string;
  project: string;
  notes: string;
  painPoints: string;
}

interface RawDataViewProps {
  onBack: () => void;
}

// --- Status helpers ---

const STATUS_RANK: Record<ProjectStatus, number> = {
  backlog: 0,
  todo: 1,
  doing: 2,
  finished: 3,
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  doing: "Doing",
  finished: "Finished",
};

function worstStatus(statuses: ProjectStatus[]): string {
  if (statuses.length === 0) return "";
  let worst = statuses[0];
  for (const s of statuses) {
    if (STATUS_RANK[s] < STATUS_RANK[worst]) {
      worst = s;
    }
  }
  return STATUS_LABELS[worst];
}

// --- Data flattening ---

function buildTaskRows(weeks: WeekEntry[]): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const week of weeks) {
    const weekLabel = week.title || week.weekId;
    for (const person of week.data.people) {
      for (const project of person.projects) {
        for (const task of project.tasks) {
          rows.push({
            taskName: task.text,
            project: project.name,
            person: person.name,
            week: weekLabel,
            status: task.completed,
          });
        }
      }
    }
  }
  return rows;
}

function buildWeekProjectRows(weeks: WeekEntry[]): WeekProjectRow[] {
  const rows: WeekProjectRow[] = [];
  for (const week of weeks) {
    const weekLabel = week.title || week.weekId;
    const projectMap = new Map<
      string,
      { displayName: string; people: string[]; statuses: ProjectStatus[] }
    >();
    for (const person of week.data.people) {
      for (const project of person.projects) {
        const key = project.name.toLowerCase();
        if (!projectMap.has(key)) {
          projectMap.set(key, {
            displayName: project.name,
            people: [],
            statuses: [],
          });
        }
        const entry = projectMap.get(key)!;
        entry.people.push(person.name);
        entry.statuses.push(project.status);
      }
    }
    for (const [, entry] of projectMap) {
      rows.push({
        week: weekLabel,
        project: entry.displayName,
        peopleAssigned: entry.people.join(", "),
        status: worstStatus(entry.statuses),
      });
    }
  }
  return rows;
}

function buildNoteRows(weeks: WeekEntry[]): NoteRow[] {
  const rows: NoteRow[] = [];
  for (const week of weeks) {
    const weekLabel = week.title || week.weekId;
    for (const person of week.data.people) {
      for (const project of person.projects) {
        const notesText = project.notes
          .map((n) => n.text)
          .filter(Boolean)
          .join("; ");
        const painPointsText = project.painPoints
          .map((p) => p.text)
          .filter(Boolean)
          .join("; ");
        if (notesText || painPointsText) {
          rows.push({
            week: weekLabel,
            person: person.name,
            project: project.name,
            notes: notesText,
            painPoints: painPointsText,
          });
        }
      }
    }
  }
  return rows;
}

// --- Week filtering ---

function parseWeekId(weekStr: string): { year: number; week: number } | null {
  const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10),
  };
}

function isWeekInRange(
  weekId: string,
  fromWeek: string,
  toWeek: string
): boolean {
  const current = parseWeekId(weekId);
  if (!current) return true;

  if (fromWeek) {
    const from = parseWeekId(fromWeek);
    if (from) {
      if (
        current.year < from.year ||
        (current.year === from.year && current.week < from.week)
      ) {
        return false;
      }
    }
  }

  if (toWeek) {
    const to = parseWeekId(toWeek);
    if (to) {
      if (
        current.year > to.year ||
        (current.year === to.year && current.week > to.week)
      ) {
        return false;
      }
    }
  }

  return true;
}

// --- Component ---

export function RawDataView({ onBack }: RawDataViewProps) {
  const [allWeeks, setAllWeeks] = useState<WeekEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fromWeek, setFromWeek] = useState("");
  const [toWeek, setToWeek] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadSheets, setDownloadSheets] = useState({
    tasks: true,
    weeksProjects: true,
    notes: true,
  });

  // Load all weeks on mount
  const loadDataRef = useState(() => {
    loadAllWeeks();
    return true;
  })[0];
  void loadDataRef;

  async function loadAllWeeks() {
    try {
      const result =
        await window.glazeAPI.glaze.ipc.invoke<AllWeeksResponse>(
          "tracker:load-all-weeks",
          {}
        );
      console.log("[RawDataView:loadData]", {
        weekCount: result.weeks.length,
      });
      setAllWeeks(result.weeks);
    } catch (error) {
      console.error("[RawDataView:loadData] error", error);
      toast.error(`Failed to load data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter weeks
  const filteredWeeks = allWeeks.filter((w) =>
    isWeekInRange(w.weekId, fromWeek, toWeek)
  );

  const handleFilterChange = useCallback(
    (from: string, to: string) => {
      console.log("[RawDataView:filter]", {
        fromWeek: from,
        toWeek: to,
        filteredCount: allWeeks.filter((w) =>
          isWeekInRange(w.weekId, from, to)
        ).length,
      });
    },
    [allWeeks]
  );

  // Derived data for each tab
  const taskRows = buildTaskRows(filteredWeeks);
  const weekProjectRows = buildWeekProjectRows(filteredWeeks);
  const noteRows = buildNoteRows(filteredWeeks);

  // Excel export
  const handleExportExcel = useCallback(async () => {
    const workbook = XLSX.utils.book_new();
    const rowCounts: Record<string, number> = {};

    if (downloadSheets.tasks) {
      const data = taskRows.map((r) => ({
        "Task Name": r.taskName,
        Project: r.project,
        Person: r.person,
        Week: r.week,
        Status: r.status ? "Done" : "Not Done",
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, sheet, "Tasks");
      rowCounts["Tasks"] = data.length;
    }

    if (downloadSheets.weeksProjects) {
      const data = weekProjectRows.map((r) => ({
        Week: r.week,
        Project: r.project,
        "People Assigned": r.peopleAssigned,
        Status: r.status,
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, sheet, "Weeks & Projects");
      rowCounts["Weeks & Projects"] = data.length;
    }

    if (downloadSheets.notes) {
      const data = noteRows.map((r) => ({
        Week: r.week,
        Person: r.person,
        Project: r.project,
        Notes: r.notes,
        "Pain Points": r.painPoints,
      }));
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, sheet, "Notes");
      rowCounts["Notes"] = data.length;
    }

    const sheets = Object.keys(rowCounts);
    console.log("[RawDataView:exportExcel]", { sheets, rowCounts });

    if (sheets.length === 0) {
      toast.error("Please select at least one sheet to export");
      return;
    }

    try {
      const base64 = XLSX.write(workbook, {
        type: "base64",
        bookType: "xlsx",
      });
      const today = new Date().toISOString().split("T")[0];
      const defaultName = `project-board-export-${today}.xlsx`;

      const result = await window.glazeAPI.glaze.ipc.invoke<{
        success: boolean;
        filePath?: string;
      }>("tracker:save-export", {
        data: base64,
        defaultName,
        filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
      });

      if (result.success) {
        toast.success("Excel file saved successfully");
      }
    } catch (error) {
      console.error("[RawDataView:exportExcel] error", error);
      toast.error(`Failed to export: ${error}`);
    }

    setDownloadDialogOpen(false);
  }, [downloadSheets, taskRows, weekProjectRows, noteRows]);

  // AI Database export
  const handleSaveAiDatabase = useCallback(async () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      weeks: filteredWeeks.map((w) => ({
        weekId: w.weekId,
        title: w.title,
        weekStart: w.weekStart,
        weekEnd: w.weekEnd,
        people: w.data.people,
      })),
    };

    console.log("[RawDataView:saveAiDb]", {
      weekCount: exportData.weeks.length,
    });

    try {
      const result = await window.glazeAPI.glaze.ipc.invoke<{
        success: boolean;
        filePath: string;
      }>("tracker:save-ai-database", {
        data: JSON.stringify(exportData),
      });

      if (result.success) {
        toast.success("AI database saved");
      }
    } catch (error) {
      console.error("[RawDataView:saveAiDb] error", error);
      toast.error(`Failed to save AI database: ${error}`);
    }
  }, [filteredWeeks]);

  const hasData =
    taskRows.length > 0 ||
    weekProjectRows.length > 0 ||
    noteRows.length > 0;

  return (
    <ScrollArea
      scrollbars="vertical"
      toolbar={
        <RawDataToolbar
          fromWeek={fromWeek}
          toWeek={toWeek}
          onFromWeekChange={(v) => {
            setFromWeek(v);
            handleFilterChange(v, toWeek);
          }}
          onToWeekChange={(v) => {
            setToWeek(v);
            handleFilterChange(fromWeek, v);
          }}
          onBack={onBack}
          onDownload={() => setDownloadDialogOpen(true)}
          onSaveAiDb={handleSaveAiDatabase}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-52px)]">
          <EmptyState>
            <EmptyStateDescription>
              Loading raw data...
            </EmptyStateDescription>
          </EmptyState>
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-52px)]">
          <EmptyState>
            <EmptyStateMedia>
              <TableIcon className="w-16 h-16 text-gray-9" />
            </EmptyStateMedia>
            <EmptyStateTitle>No data found</EmptyStateTitle>
            <EmptyStateDescription>
              No data found for the selected week range
            </EmptyStateDescription>
          </EmptyState>
        </div>
      ) : (
        <div className="px-6 py-4">
          <TabsRoot value={activeTab} onValueChange={setActiveTab}>
            <Tabs variant="filled" size="large">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="weeksProjects">
                Weeks & Projects
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </Tabs>

            <TabsContent value="tasks">
              <TasksTable rows={taskRows} />
            </TabsContent>

            <TabsContent value="weeksProjects">
              <WeeksProjectsTable rows={weekProjectRows} />
            </TabsContent>

            <TabsContent value="notes">
              <NotesTable rows={noteRows} />
            </TabsContent>
          </TabsRoot>
        </div>
      )}

      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        sheets={downloadSheets}
        onSheetsChange={setDownloadSheets}
        onDownload={handleExportExcel}
      />
    </ScrollArea>
  );
}

// --- Sub-components ---

function RawDataToolbar({
  fromWeek,
  toWeek,
  onFromWeekChange,
  onToWeekChange,
  onBack,
  onDownload,
  onSaveAiDb,
}: {
  fromWeek: string;
  toWeek: string;
  onFromWeekChange: (v: string) => void;
  onToWeekChange: (v: string) => void;
  onBack: () => void;
  onDownload: () => void;
  onSaveAiDb: () => void;
}) {
  return (
    <Toolbar background="full-blur" inset="windowControls">
      <ToolbarContent>
        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="large"
            iconOnly
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-4.5 text-gray-11" />
          </Button>
          <ToolbarTitle>Raw Data</ToolbarTitle>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Label className="text-[11px] text-gray-11 whitespace-nowrap">
            From
          </Label>
          <Input
            value={fromWeek}
            onChange={(e) => onFromWeekChange(e.target.value)}
            placeholder="e.g. 2026-W40"
            className="h-6 w-28 text-[11px]"
          />
          <Label className="text-[11px] text-gray-11 whitespace-nowrap">
            To
          </Label>
          <Input
            value={toWeek}
            onChange={(e) => onToWeekChange(e.target.value)}
            placeholder="e.g. 2026-W42"
            className="h-6 w-28 text-[11px]"
          />
        </div>
      </ToolbarContent>
      <ToolbarActions>
        <Button variant="glass" size="large" onClick={onDownload}>
          <DownloadIcon className="size-4.5 text-gray-11" />
          Download Excel
        </Button>
        <Button variant="glass" size="large" onClick={onSaveAiDb}>
          <DatabaseIcon className="size-4.5 text-gray-11" />
          Save AI Database
        </Button>
      </ToolbarActions>
    </Toolbar>
  );
}

function TasksTable({ rows }: { rows: TaskRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <EmptyState>
          <EmptyStateDescription>
            No tasks found for the selected week range
          </EmptyStateDescription>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Task Name</TableHead>
            <TableHead className="text-[11px]">Project</TableHead>
            <TableHead className="text-[11px]">Person</TableHead>
            <TableHead className="text-[11px]">Week</TableHead>
            <TableHead className="text-[11px] w-20">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`task-${i}`}>
              <TableCell className="text-[12px]">
                {row.taskName}
              </TableCell>
              <TableCell className="text-[12px]">
                {row.project}
              </TableCell>
              <TableCell className="text-[12px]">
                {row.person}
              </TableCell>
              <TableCell className="text-[12px]">{row.week}</TableCell>
              <TableCell className="text-[12px]">
                {row.status ? (
                  <CheckIcon className="size-4 text-green-10" />
                ) : (
                  <MinusIcon className="size-4 text-gray-9" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WeeksProjectsTable({ rows }: { rows: WeekProjectRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <EmptyState>
          <EmptyStateDescription>
            No project data found for the selected week range
          </EmptyStateDescription>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Week</TableHead>
            <TableHead className="text-[11px]">Project</TableHead>
            <TableHead className="text-[11px]">
              People Assigned
            </TableHead>
            <TableHead className="text-[11px] w-24">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`wp-${i}`}>
              <TableCell className="text-[12px]">{row.week}</TableCell>
              <TableCell className="text-[12px]">
                {row.project}
              </TableCell>
              <TableCell className="text-[12px]">
                {row.peopleAssigned}
              </TableCell>
              <TableCell className="text-[12px]">
                {row.status}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function NotesTable({ rows }: { rows: NoteRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <EmptyState>
          <EmptyStateDescription>
            No notes or pain points found for the selected week range
          </EmptyStateDescription>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Week</TableHead>
            <TableHead className="text-[11px]">Person</TableHead>
            <TableHead className="text-[11px]">Project</TableHead>
            <TableHead className="text-[11px]">Notes</TableHead>
            <TableHead className="text-[11px]">Pain Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`note-${i}`}>
              <TableCell className="text-[12px]">{row.week}</TableCell>
              <TableCell className="text-[12px]">
                {row.person}
              </TableCell>
              <TableCell className="text-[12px]">
                {row.project}
              </TableCell>
              <TableCell className="text-[12px]">{row.notes}</TableCell>
              <TableCell className="text-[12px]">
                {row.painPoints}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DownloadDialog({
  open,
  onOpenChange,
  sheets,
  onSheetsChange,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheets: { tasks: boolean; weeksProjects: boolean; notes: boolean };
  onSheetsChange: (sheets: {
    tasks: boolean;
    weeksProjects: boolean;
    notes: boolean;
  }) => void;
  onDownload: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Excel</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Label className="text-[12px] text-gray-11">
            Select sheets to include:
          </Label>
          <div className="space-y-2">
            <Label>
              <Checkbox
                checked={sheets.tasks}
                onCheckedChange={(checked) =>
                  onSheetsChange({
                    ...sheets,
                    tasks: checked === true,
                  })
                }
              />
              Tasks
            </Label>
            <Label>
              <Checkbox
                checked={sheets.weeksProjects}
                onCheckedChange={(checked) =>
                  onSheetsChange({
                    ...sheets,
                    weeksProjects: checked === true,
                  })
                }
              />
              Weeks & Projects
            </Label>
            <Label>
              <Checkbox
                checked={sheets.notes}
                onCheckedChange={(checked) =>
                  onSheetsChange({
                    ...sheets,
                    notes: checked === true,
                  })
                }
              />
              Notes
            </Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="filled">Cancel</Button>
          </DialogClose>
          <Button variant="accent" onClick={onDownload}>
            <DownloadIcon className="size-4 text-gray-1" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
