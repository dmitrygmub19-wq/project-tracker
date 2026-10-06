import { useState, useCallback, useRef, useEffect } from "react";
import { PlusIcon, CalendarIcon } from "lucide-react";
import {
  Button,
  ScrollArea,
  PanelGroup,
  Panel,
  EmptyState,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateActions,
  EmptyStateMedia,
} from "@glaze/core/components";
import { toast } from "sonner";
import { WeekHeader, formatWeekRange } from "./components/WeekHeader";
import { PersonSection } from "./components/PersonSection";
import { SettingsSidebar } from "./components/SettingsSidebar";
import {
  TransferDialog,
  getUnfinishedProjects,
  mergeTransfer,
} from "./components/TransferDialog";
import { RawDataView } from "./components/RawDataView";
import type { TransferPayload } from "./components/TransferDialog";
import type { WeekData, Person, BoardTemplate } from "./types";

// --- Helpers ---

function getCurrentWeekId(): string {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));

  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const dayOfYear =
    Math.floor(
      (monday.getTime() - jan4.getTime()) / (24 * 60 * 60 * 1000)
    ) + 1;
  const jan4DayOfWeek = jan4.getDay() || 7;
  const weekNumber = Math.ceil(
    (dayOfYear + (jan4DayOfWeek - 1)) / 7
  );

  return `${monday.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function shiftWeekId(weekId: string, delta: number): string {
  const match = weekId.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekId;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));

  const monday = new Date(mondayOfWeek1);
  monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

  monday.setDate(monday.getDate() + delta * 7);

  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const newYear = thursday.getFullYear();
  const newJan4 = new Date(newYear, 0, 4);
  const newJan4Dow = newJan4.getDay() || 7;
  const newMondayOfWeek1 = new Date(newJan4);
  newMondayOfWeek1.setDate(newJan4.getDate() - (newJan4Dow - 1));

  const mondayUtc = Date.UTC(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate()
  );
  const weekOneMondayUtc = Date.UTC(
    newMondayOfWeek1.getFullYear(),
    newMondayOfWeek1.getMonth(),
    newMondayOfWeek1.getDate()
  );
  const newWeek =
    Math.floor((mondayUtc - weekOneMondayUtc) / (7 * 24 * 60 * 60 * 1000)) +
    1;

  return `${newYear}-W${String(newWeek).padStart(2, "0")}`;
}

function createEmptyWeekData(): WeekData {
  return { people: [] };
}

function createWeekDataFromBoardTemplate(template: BoardTemplate): WeekData {
  return {
    people: template.people.map((name) => ({
      id: crypto.randomUUID(),
      name,
      projects: template.projects.map((projectName) => ({
        id: crypto.randomUUID(),
        name: projectName,
        status: "backlog" as const,
        tasks: [],
        notes: [],
        painPoints: [],
      })),
    })),
  };
}

// --- IPC ---

async function loadWeek(weekId: string): Promise<WeekData | null> {
  console.log("[HomeView:loadWeek]", { weekId });
  try {
    const result = await window.glazeAPI.glaze.ipc.invoke<{
      data: WeekData | null;
    }>("tracker:load-week", { weekId });
    console.log("[HomeView:loadWeek] result", {
      weekId,
      hasData: result.data !== null,
    });
    return result.data;
  } catch (error) {
    console.error("[HomeView:loadWeek] error", { weekId, error });
    toast.error(`Failed to load week: ${error}`);
    return null;
  }
}

async function saveWeek(
  weekId: string,
  data: WeekData
): Promise<boolean> {
  console.log("[HomeView:saveWeek]", {
    weekId,
    peopleCount: data.people.length,
  });
  try {
    const result = await window.glazeAPI.glaze.ipc.invoke<{
      success: boolean;
    }>("tracker:save-week", { weekId, data });
    console.log("[HomeView:saveWeek] result", {
      weekId,
      success: result.success,
    });
    return result.success;
  } catch (error) {
    console.error("[HomeView:saveWeek] error", { weekId, error });
    return false;
  }
}

async function deleteWeekData(weekId: string): Promise<boolean> {
  console.log("[HomeView:deleteWeek]", { weekId });
  try {
    const result = await window.glazeAPI.glaze.ipc.invoke<{
      success: boolean;
    }>("tracker:delete-week", { weekId });
    return result.success;
  } catch (error) {
    console.error("[HomeView:deleteWeek] error", { weekId, error });
    return false;
  }
}

// --- Component ---

export function HomeView() {
  const [weekId, setWeekId] = useState(getCurrentWeekId);
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  // Transfer dialog state
  const [transferPayload, setTransferPayload] = useState<TransferPayload | null>(null);
  const [transferPrevWeekId, setTransferPrevWeekId] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // Refs for debounced save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<WeekData | null>(null);
  const latestWeekIdRef = useRef(weekId);

  latestWeekIdRef.current = weekId;

  // Load week data when weekId changes
  useEffect(() => {
    let cancelled = false;

    const doLoad = async () => {
      setIsLoading(true);
      setTransferPayload(null);
      setShowTransferDialog(false);
      setTransferPrevWeekId("");

      const data = await loadWeek(weekId);
      if (cancelled) return;

      let currentData: WeekData;
      if (data) {
        currentData = data;
      } else {
        currentData = createEmptyWeekData();
      }

      setWeekData(currentData);
      latestDataRef.current = currentData;
      setIsLoading(false);

      // Load previous-week projects for the empty-state transfer action.
      if (currentData.people.length === 0) {
        const prevWeekId = shiftWeekId(weekId, -1);
        const prevData = await loadWeek(prevWeekId);
        if (cancelled) return;

        if (prevData) {
          const payload = getUnfinishedProjects(prevData);
          if (payload) {
            console.log("[HomeView:transferCheck]", {
              prevWeekId,
              unfinishedPeople: payload.people.length,
            });
            setTransferPrevWeekId(prevWeekId);
            setTransferPayload(payload);
            if (
              !currentData.transferDismissed &&
              latestDataRef.current?.people.length === 0
            ) {
              setShowTransferDialog(true);
            }
          }
        }
      }
    };

    doLoad();

    return () => {
      cancelled = true;
    };
  }, [weekId]);

  // Debounced auto-save
  const scheduleSave = useCallback(
    (data: WeekData) => {
      latestDataRef.current = data;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const currentData = latestDataRef.current;
        const currentWeekId = latestWeekIdRef.current;
        if (currentData) {
          saveWeek(currentWeekId, currentData);
        }
      }, 500);
    },
    []
  );

  // Flush save on unmount (only if there's a pending save from user changes)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const currentData = latestDataRef.current;
        const currentWeekId = latestWeekIdRef.current;
        if (currentData) {
          saveWeek(currentWeekId, currentData);
        }
      }
    };
  }, []);

  // Update data + schedule save
  const updateWeekData = useCallback(
    (updater: (prev: WeekData) => WeekData) => {
      setWeekData((prev) => {
        const current = prev ?? createEmptyWeekData();
        const next = updater(current);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  // --- Flush helper ---

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const currentData = latestDataRef.current;
      const currentWeekId = latestWeekIdRef.current;
      if (currentData) {
        saveWeek(currentWeekId, currentData);
      }
    }
  }, []);

  // --- Week navigation ---

  const handlePreviousWeek = useCallback(() => {
    flushSave();
    console.log("[HomeView:previousWeek]", { currentWeekId: weekId });
    setWeekId((prev) => shiftWeekId(prev, -1));
  }, [weekId, flushSave]);

  const handleNextWeek = useCallback(() => {
    flushSave();
    console.log("[HomeView:nextWeek]", { currentWeekId: weekId });
    setWeekId((prev) => shiftWeekId(prev, 1));
  }, [weekId, flushSave]);

  const handleCreateBoard = useCallback(
    (template?: BoardTemplate) => {
      const newWeekId = getCurrentWeekId();
      console.log("[HomeView:createBoard]", {
        weekId: newWeekId,
        templateName: template?.name,
      });
      flushSave();
      if (template) {
        const newData = createWeekDataFromBoardTemplate(template);
        setWeekData(newData);
        latestDataRef.current = newData;
        saveWeek(newWeekId, newData);
      }
      setWeekId(newWeekId);
    },
    [flushSave]
  );

  const handleNavigateToWeek = useCallback(
    (targetWeekId: string) => {
      console.log("[HomeView:navigateToWeek]", { targetWeekId });
      flushSave();
      setWeekId(targetWeekId);
    },
    [flushSave]
  );

  const handleDeleteWeek = useCallback(
    async (targetWeekId: string) => {
      console.log("[HomeView:deleteWeek]", { targetWeekId });
      await deleteWeekData(targetWeekId);
      // If we deleted the current week, reload
      if (targetWeekId === weekId) {
        setWeekData(createEmptyWeekData());
        latestDataRef.current = createEmptyWeekData();
      }
    },
    [weekId]
  );

  // --- Week title ---

  const handleTitleChange = useCallback(
    (title: string) => {
      updateWeekData((prev) => ({ ...prev, title }));
    },
    [updateWeekData]
  );

  // --- Person management ---

  const addPerson = useCallback(() => {
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name: "",
      projects: [],
    };
    console.log("[HomeView:addPerson]", { personId: newPerson.id });
    updateWeekData((prev) => ({
      ...prev,
      people: [...prev.people, newPerson],
    }));
  }, [updateWeekData]);

  const updatePerson = useCallback(
    (personId: string, updated: Person) => {
      updateWeekData((prev) => ({
        ...prev,
        people: prev.people.map((p) =>
          p.id === personId ? updated : p
        ),
      }));
    },
    [updateWeekData]
  );

  const deletePerson = useCallback(
    (personId: string) => {
      console.log("[HomeView:deletePerson]", { personId });
      updateWeekData((prev) => ({
        ...prev,
        people: prev.people.filter((p) => p.id !== personId),
      }));
    },
    [updateWeekData]
  );

  // --- Move item between cards ---

  const handleMoveItem = useCallback(
    (
      sourcePersonId: string,
      sourceProjectId: string,
      itemType: "task" | "note" | "painPoint",
      itemId: string,
      targetPersonId: string,
      targetProjectId: string,
    ) => {
      // Skip if same card
      if (sourcePersonId === targetPersonId && sourceProjectId === targetProjectId) return;

      console.log("[HomeView:moveItem]", {
        itemType,
        itemId,
        sourcePersonId,
        sourceProjectId,
        targetPersonId,
        targetProjectId,
      });

      updateWeekData((prev) => {
        // Deep clone people/projects to avoid mutations
        const people = prev.people.map((p) => ({
          ...p,
          projects: p.projects.map((pr) => ({
            ...pr,
            tasks: [...pr.tasks],
            notes: [...pr.notes],
            painPoints: [...pr.painPoints],
          })),
        }));

        const sourceProject = people
          .find((p) => p.id === sourcePersonId)
          ?.projects.find((pr) => pr.id === sourceProjectId);
        const targetProject = people
          .find((p) => p.id === targetPersonId)
          ?.projects.find((pr) => pr.id === targetProjectId);

        if (!sourceProject || !targetProject) return prev;

        if (itemType === "task") {
          const idx = sourceProject.tasks.findIndex((t) => t.id === itemId);
          if (idx === -1) return prev;
          const [item] = sourceProject.tasks.splice(idx, 1);
          targetProject.tasks.push(item);
        } else if (itemType === "note") {
          const idx = sourceProject.notes.findIndex((n) => n.id === itemId);
          if (idx === -1) return prev;
          const [item] = sourceProject.notes.splice(idx, 1);
          targetProject.notes.push(item);
        } else {
          const idx = sourceProject.painPoints.findIndex((p) => p.id === itemId);
          if (idx === -1) return prev;
          const [item] = sourceProject.painPoints.splice(idx, 1);
          targetProject.painPoints.push(item);
        }

        return { ...prev, people };
      });
    },
    [updateWeekData]
  );

  // --- Sync project names across board ---

  const handleSyncProjectName = useCallback(
    (oldName: string, newName: string) => {
      console.log("[HomeView:syncProjectName]", { oldName, newName });
      updateWeekData((prev) => ({
        ...prev,
        people: prev.people.map((person) => ({
          ...person,
          projects: person.projects.map((project) =>
            project.name.toLowerCase() === oldName.toLowerCase()
              ? { ...project, name: newName }
              : project
          ),
        })),
      }));
    },
    [updateWeekData]
  );

  // --- Transfer ---

  const handleTransfer = useCallback(() => {
    if (
      !transferPayload ||
      isLoading ||
      !weekData ||
      weekData.people.length > 0
    ) {
      return;
    }
    console.log("[HomeView:transfer]", { weekId });
    updateWeekData((prev) => {
      if (prev.people.length > 0) return prev;
      const merged = mergeTransfer(prev, transferPayload);
      return { ...merged, transferDismissed: true };
    });
    setShowTransferDialog(false);
  }, [isLoading, transferPayload, weekData, weekId, updateWeekData]);

  const handleTransferSkip = useCallback(() => {
    console.log("[HomeView:transferSkip]", { weekId });
    updateWeekData((prev) => ({ ...prev, transferDismissed: true }));
    setShowTransferDialog(false);
  }, [weekId, updateWeekData]);

  // --- Render ---

  const mainContent = isLoading ? (
    <div className="flex items-center justify-center min-h-[calc(100vh-52px)]">
      <EmptyState>
        <EmptyStateDescription>
          Loading week data...
        </EmptyStateDescription>
      </EmptyState>
    </div>
  ) : weekData && weekData.people.length > 0 ? (
    <div className="px-6 py-4 flex flex-col gap-4">
      {weekData.people.map((person) => (
        <PersonSection
          key={person.id}
          person={person}
          onUpdate={(updated) =>
            updatePerson(person.id, updated)
          }
          onDelete={() => deletePerson(person.id)}
          onMoveItem={handleMoveItem}
          onSyncProjectName={handleSyncProjectName}
        />
      ))}

      <div className="pb-4">
        <Button
          variant="filled"
          size="medium"
          onClick={addPerson}
        >
          <PlusIcon className="size-4 text-gray-11" />
          Add Person
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center min-h-[calc(100vh-52px)]">
      <EmptyState>
        <EmptyStateMedia>
          <CalendarIcon className="w-16 h-16 text-gray-9" />
        </EmptyStateMedia>
        <EmptyStateTitle>No data for this week</EmptyStateTitle>
        <EmptyStateDescription>
          Add a team member to start tracking projects and tasks.
        </EmptyStateDescription>
        <EmptyStateActions>
          <Button
            variant="filled"
            onClick={handleTransfer}
            disabled={
              isLoading ||
              !transferPayload ||
              !weekData ||
              weekData.people.length > 0
            }
            title={
              transferPayload
                ? "Copy unfinished projects from the previous week"
                : "No unfinished projects in the previous week"
            }
          >
            Transfer it from previous week
          </Button>
          <Button variant="accent" onClick={addPerson}>
            <PlusIcon className="size-4 text-gray-1" />
            Add Person
          </Button>
        </EmptyStateActions>
      </EmptyState>
    </div>
  );

  return (
    <>
    <PanelGroup storageKey="main-layout">
      <Panel
        defaultSize={280}
        minSize={220}
        maxSize={400}
        hidden={!sidebarOpen}
      >
        <SettingsSidebar
          currentWeekId={weekId}
          onNavigateToWeek={handleNavigateToWeek}
          onDeleteWeek={handleDeleteWeek}
          onCreateBoard={handleCreateBoard}
        />
      </Panel>
      <Panel minSize={600}>
        {showRawData ? (
          <RawDataView onBack={() => setShowRawData(false)} />
        ) : (
          <ScrollArea
            scrollbars="vertical"
            toolbar={
              <WeekHeader
                weekId={weekId}
                weekTitle={weekData?.title}
                sidebarOpen={sidebarOpen}
                onPreviousWeek={handlePreviousWeek}
                onNextWeek={handleNextWeek}
                onTitleChange={handleTitleChange}
                onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
                onViewRawData={() => setShowRawData(true)}
              />
            }
          >
            {mainContent}
          </ScrollArea>
        )}
      </Panel>
    </PanelGroup>

    {transferPayload && (
      <TransferDialog
        open={showTransferDialog}
        payload={transferPayload}
        previousWeekLabel={formatWeekRange(transferPrevWeekId)}
        onTransfer={handleTransfer}
        onSkip={handleTransferSkip}
      />
    )}
    </>
  );
}
