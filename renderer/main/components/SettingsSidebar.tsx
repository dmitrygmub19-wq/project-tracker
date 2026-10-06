import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  PlusIcon,
  XIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  LayoutTemplateIcon,
  UsersIcon,
  FolderIcon,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Separator,
  Sidebar,
  Toolbar,
  ToolbarRow,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@glaze/core/components";
import { WeekCalendar } from "./WeekCalendar";
import type { WeekListItem, BoardTemplate } from "../types";

interface SettingsSidebarProps {
  currentWeekId: string;
  onNavigateToWeek: (weekId: string) => void;
  onDeleteWeek: (weekId: string) => void;
  onCreateBoard: (template?: BoardTemplate) => void;
}

function formatWeekLabel(week: WeekListItem): string {
  const [, sm, sd] = week.weekStart.split("-");
  const [, em, ed] = week.weekEnd.split("-");
  return `${sd}/${sm} — ${ed}/${em}`;
}

// --- Template Item Editor ---

interface TemplateItemListProps {
  items: string[];
  icon: ReactNode;
  label: string;
  placeholder: string;
  onAdd: (value: string) => void;
  onRename: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

function TemplateItemList({
  items,
  icon,
  label,
  placeholder,
  onAdd,
  onRename,
  onRemove,
}: TemplateItemListProps) {
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    if (!newValue.trim()) return;
    onAdd(newValue.trim());
    setNewValue("");
  };

  return (
    <div className="flex flex-col gap-1 pl-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <Label className="text-[10px] font-semibold text-gray-9 uppercase tracking-wide">
          {label}
        </Label>
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-1 rounded-md group"
            >
              <Input
                value={item}
                onChange={(e) => onRename(index, e.target.value)}
                className="h-6 text-[11px] flex-1 min-w-0"
              />
              <Button
                variant="transparent"
                size="small"
                iconOnly
                onClick={() => onRemove(index)}
                className="opacity-0 group-hover:opacity-100 shrink-0"
              >
                <XIcon className="size-3 text-gray-9" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={placeholder}
          className="h-6 text-[11px] flex-1"
        />
        <Button
          variant="filled"
          size="small"
          iconOnly
          onClick={handleAdd}
          className="shrink-0"
        >
          <PlusIcon className="size-3 text-gray-11" />
        </Button>
      </div>
    </div>
  );
}

// --- Single Template Row ---

interface TemplateRowProps {
  template: BoardTemplate;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updated: BoardTemplate) => void;
  onDelete: () => void;
}

function TemplateRow({
  template,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: TemplateRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 group">
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={onToggle}
          className="shrink-0"
        >
          {isExpanded ? (
            <ChevronDownIcon className="size-3 text-gray-9" />
          ) : (
            <ChevronRightIcon className="size-3 text-gray-9" />
          )}
        </Button>
        {isEditingName ? (
          <Input
            value={template.name}
            onChange={(e) => onUpdate({ ...template, name: e.target.value })}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditingName(false);
            }}
            autoFocus
            className="h-6 text-[11px] flex-1 min-w-0"
          />
        ) : (
          <span
            className="text-[11px] font-medium text-gray-12 cursor-text truncate flex-1 min-w-0"
            onClick={() => setIsEditingName(true)}
          >
            {template.name || "Untitled Template"}
          </span>
        )}
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 shrink-0"
        >
          <TrashIcon className="size-3 text-gray-9" />
        </Button>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-2 mt-1">
          <TemplateItemList
            items={template.people}
            icon={<UsersIcon className="size-3 text-gray-9" />}
            label="People"
            placeholder="Add person..."
            onAdd={(value) =>
              onUpdate({ ...template, people: [...template.people, value] })
            }
            onRename={(index, value) =>
              onUpdate({
                ...template,
                people: template.people.map((p, i) =>
                  i === index ? value : p
                ),
              })
            }
            onRemove={(index) =>
              onUpdate({
                ...template,
                people: template.people.filter((_, i) => i !== index),
              })
            }
          />
          <TemplateItemList
            items={template.projects}
            icon={<FolderIcon className="size-3 text-gray-9" />}
            label="Projects"
            placeholder="Add project..."
            onAdd={(value) =>
              onUpdate({
                ...template,
                projects: [...template.projects, value],
              })
            }
            onRename={(index, value) =>
              onUpdate({
                ...template,
                projects: template.projects.map((p, i) =>
                  i === index ? value : p
                ),
              })
            }
            onRemove={(index) =>
              onUpdate({
                ...template,
                projects: template.projects.filter((_, i) => i !== index),
              })
            }
          />
        </div>
      )}
    </div>
  );
}

// --- Main Sidebar ---

export function SettingsSidebar({
  currentWeekId,
  onNavigateToWeek,
  onDeleteWeek,
  onCreateBoard,
}: SettingsSidebarProps) {
  const [weeks, setWeeks] = useState<WeekListItem[]>([]);
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(
    null
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{ weekId: string; name: string } | null>(null);

  // Load weeks list
  const loadWeeks = useCallback(async () => {
    console.log("[SettingsSidebar:loadWeeks]");
    try {
      const result = await window.glazeAPI.glaze.ipc.invoke<{
        weeks: WeekListItem[];
      }>("tracker:list-weeks", {});
      setWeeks(result.weeks);
    } catch (error) {
      console.error("[SettingsSidebar:loadWeeks] error", error);
    }
  }, []);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const result = await window.glazeAPI.glaze.ipc.invoke<{
        templates: BoardTemplate[];
      }>("tracker:list-templates", {});
      console.log("[SettingsSidebar:loadTemplates]", {
        count: result.templates.length,
      });
      setTemplates(result.templates);
    } catch (error) {
      console.error("[SettingsSidebar:loadTemplates] error", error);
    }
  }, []);

  useEffect(() => {
    loadWeeks();
    loadTemplates();
  }, [loadWeeks, loadTemplates]);

  // Save templates
  const saveTemplates = useCallback(async (updated: BoardTemplate[]) => {
    console.log("[SettingsSidebar:saveTemplates]", { count: updated.length });
    try {
      await window.glazeAPI.glaze.ipc.invoke("tracker:save-templates", {
        templates: updated,
      });
    } catch (error) {
      console.error("[SettingsSidebar:saveTemplates] error", error);
    }
  }, []);

  const updateTemplate = useCallback(
    (templateId: string, updated: BoardTemplate) => {
      const next = templates.map((t) => (t.id === templateId ? updated : t));
      setTemplates(next);
      saveTemplates(next);
    },
    [templates, saveTemplates]
  );

  const deleteTemplate = useCallback(
    (templateId: string) => {
      const next = templates.filter((t) => t.id !== templateId);
      setTemplates(next);
      saveTemplates(next);
      if (expandedTemplateId === templateId) {
        setExpandedTemplateId(null);
      }
    },
    [templates, saveTemplates, expandedTemplateId]
  );

  const addTemplate = useCallback(() => {
    const newTemplate: BoardTemplate = {
      id: crypto.randomUUID(),
      name: "",
      people: [],
      projects: [],
    };
    const next = [...templates, newTemplate];
    setTemplates(next);
    saveTemplates(next);
    setExpandedTemplateId(newTemplate.id);
  }, [templates, saveTemplates]);

  const handleRequestDelete = (weekId: string, name: string) => {
    setDeleteConfirm({ weekId, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    console.log("[SettingsSidebar:deleteWeek]", { weekId: deleteConfirm.weekId });
    onDeleteWeek(deleteConfirm.weekId);
    setDeleteConfirm(null);
    setTimeout(loadWeeks, 300);
  };

  const handleCreateBoard = (template?: BoardTemplate) => {
    console.log("[SettingsSidebar:createBoard]", {
      templateName: template?.name,
    });
    onCreateBoard(template);
  };

  return (
    <Sidebar
      toolbar={
        <Toolbar>
          <ToolbarRow />
        </Toolbar>
      }
    >
      <div className="flex flex-col gap-4 px-3 py-3">
        {/* Calendar */}
        <WeekCalendar
          currentWeekId={currentWeekId}
          onSelectWeek={onNavigateToWeek}
        />

        {/* All boards header + create button */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="transparent"
                  size="small"
                  iconOnly
                  className="shrink-0"
                >
                  <PlusIcon className="size-3.5 text-gray-11" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => handleCreateBoard()}
                >
                  Empty Board
                </DropdownMenuItem>
                {templates.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>From Template</DropdownMenuLabel>
                    {templates.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onSelect={() => handleCreateBoard(t)}
                      >
                        {t.name || "Untitled Template"}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Label className="text-[10px] font-semibold text-gray-9 uppercase tracking-wide">
              All Boards
            </Label>
          </div>

          {/* Boards list */}
          {weeks.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {weeks.map((week) => (
                <div
                  key={week.weekId}
                  className={`flex items-center justify-between rounded-md px-2 py-1 cursor-pointer group ${
                    week.weekId === currentWeekId
                      ? "bg-blue-a3 text-blue-11"
                      : "hover:bg-gray-a3 text-gray-12"
                  }`}
                  onClick={() => onNavigateToWeek(week.weekId)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium truncate">
                      {week.title || formatWeekLabel(week)}
                    </span>
                    <span className="text-[10px] text-gray-9 truncate">
                      {formatWeekLabel(week)}
                    </span>
                  </div>
                  <Button
                    variant="transparent"
                    size="small"
                    iconOnly
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestDelete(
                        week.weekId,
                        week.title || formatWeekLabel(week)
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <TrashIcon className="size-3 text-gray-9" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Board Templates */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <LayoutTemplateIcon className="size-4 text-gray-10" />
            <Label className="text-[10px] font-semibold text-gray-9 uppercase tracking-wide">
              Board Templates
            </Label>
          </div>

          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {templates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  isExpanded={expandedTemplateId === template.id}
                  onToggle={() =>
                    setExpandedTemplateId(
                      expandedTemplateId === template.id
                        ? null
                        : template.id
                    )
                  }
                  onUpdate={(updated) => updateTemplate(template.id, updated)}
                  onDelete={() => deleteTemplate(template.id)}
                />
              ))}
            </div>
          )}

          <Button
            variant="filled"
            size="small"
            onClick={addTemplate}
            className="w-full"
          >
            <PlusIcon className="size-3.5 text-gray-11" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction className="bg-red-9 text-gray-1 hover:bg-red-10" onClick={handleConfirmDelete}>
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
