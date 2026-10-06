import { useState } from "react";
import {
  XIcon,
  CircleIcon,
  GripVerticalIcon,
  StickyNoteIcon,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Separator,
} from "@glaze/core/components";
import type { Project, ProjectStatus, Task, TextItem } from "../types";
import { STATUS_OPTIONS } from "../types";

// Module-level drag state (shared across all ProjectCard instances)
let dragState: {
  type: "task" | "note" | "painPoint";
  itemId: string;
  sourcePersonId: string;
  sourceProjectId: string;
} | null = null;

/**
 * Auto-compute project status based on task completion:
 * - No tasks → "finished"
 * - All completed → "finished"
 * - Some completed, some not → "doing"
 * - None completed → keep current status
 */
function computeAutoStatus(tasks: Task[], currentStatus: ProjectStatus): ProjectStatus {
  if (tasks.length === 0) return "finished";
  const completedCount = tasks.filter((t) => t.completed).length;
  if (completedCount === tasks.length) return "finished";
  if (completedCount > 0) return "doing";
  return currentStatus;
}

interface ProjectCardProps {
  project: Project;
  personId: string;
  onUpdate: (updated: Project) => void;
  onDelete: () => void;
  onMoveItem: (
    sourcePersonId: string,
    sourceProjectId: string,
    itemType: "task" | "note" | "painPoint",
    itemId: string,
    targetPersonId: string,
    targetProjectId: string,
  ) => void;
  onSyncProjectName?: (oldName: string, newName: string) => void;
}

function getStatusColor(status: ProjectStatus): string {
  switch (status) {
    case "backlog":
      return "fill-gray-9 text-gray-9";
    case "todo":
      return "fill-blue-9 text-blue-9";
    case "doing":
      return "fill-orange-9 text-orange-9";
    case "finished":
      return "fill-green-9 text-green-9";
  }
}

function getStatusBadgeClasses(status: ProjectStatus): string {
  switch (status) {
    case "backlog":
      return "bg-gray-3 text-gray-11";
    case "todo":
      return "bg-blue-3 text-blue-11";
    case "doing":
      return "bg-orange-3 text-orange-11";
    case "finished":
      return "bg-green-3 text-green-11";
  }
}

function TaskItem({
  task,
  onToggle,
  onUpdateText,
  onDelete,
  personId,
  projectId,
}: {
  task: Task;
  onToggle: (checked: boolean) => void;
  onUpdateText: (text: string) => void;
  onDelete: () => void;
  personId: string;
  projectId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: { dataTransfer: DataTransfer }) => {
    dragState = {
      type: "task",
      itemId: task.id,
      sourcePersonId: personId,
      sourceProjectId: projectId,
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.text);
    setIsDragging(true);
    console.log("[ProjectCard:dragStart]", {
      type: "task",
      itemId: task.id,
      sourcePersonId: personId,
      sourceProjectId: projectId,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    dragState = null;
  };

  return (
    <div
      className={`flex items-start gap-1 group ${isDragging ? "opacity-30" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <GripVerticalIcon className="size-3 text-gray-8 mt-1.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-100" />
      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="mt-0.5 shrink-0"
      />
      {isEditing ? (
        <Input
          value={task.text}
          onChange={(e) => onUpdateText(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setIsEditing(false);
            }
          }}
          autoFocus
          className="h-6 text-xs px-1 min-w-0 flex-1"
        />
      ) : (
        <span
          className={`text-xs leading-5 flex-1 min-w-0 cursor-text break-words ${
            task.completed ? "line-through text-gray-9" : "text-gray-12"
          }`}
          onClick={() => setIsEditing(true)}
        >
          {task.text || "Untitled task"}
        </span>
      )}
      <Button
        variant="transparent"
        size="small"
        iconOnly
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 shrink-0 !h-5 !w-5"
      >
        <XIcon className="size-3 text-gray-9" />
      </Button>
    </div>
  );
}

function TextItemRow({
  item,
  onUpdateText,
  onDelete,
  personId,
  projectId,
  itemType,
  textClassName,
}: {
  item: TextItem;
  onUpdateText: (text: string) => void;
  onDelete: () => void;
  personId: string;
  projectId: string;
  itemType: "note" | "painPoint";
  textClassName?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: { dataTransfer: DataTransfer }) => {
    dragState = {
      type: itemType,
      itemId: item.id,
      sourcePersonId: personId,
      sourceProjectId: projectId,
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.text);
    setIsDragging(true);
    console.log("[ProjectCard:dragStart]", {
      type: itemType,
      itemId: item.id,
      sourcePersonId: personId,
      sourceProjectId: projectId,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    dragState = null;
  };

  return (
    <div
      className={`flex items-start gap-1 group ${isDragging ? "opacity-30" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <GripVerticalIcon className="size-3 text-gray-8 mt-1.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-100" />
      {isEditing ? (
        <Input
          value={item.text}
          onChange={(e) => onUpdateText(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setIsEditing(false);
            }
          }}
          autoFocus
          className="h-6 text-xs px-1 min-w-0 flex-1"
        />
      ) : (
        <span
          className={`text-xs leading-5 flex-1 min-w-0 cursor-text break-words ${textClassName ?? "text-gray-12"}`}
          onClick={() => setIsEditing(true)}
        >
          {item.text || "Empty item"}
        </span>
      )}
      <Button
        variant="transparent"
        size="small"
        iconOnly
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 shrink-0 !h-5 !w-5"
      >
        <XIcon className="size-3 text-gray-9" />
      </Button>
    </div>
  );
}

function NewItemInput({
  onAdd,
  placeholder,
  className,
}: {
  onAdd: (text: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [value, setValue] = useState("");

  const handleKeyDown = (e: { key: string }) => {
    if (e.key === "Enter" && value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`h-6 text-xs px-1.5 mt-0.5 ${className ?? ""}`}
    />
  );
}

export function ProjectCard({
  project,
  personId,
  onUpdate,
  onDelete,
  onMoveItem,
  onSyncProjectName,
}: ProjectCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameBeforeEdit, setNameBeforeEdit] = useState("");
  const [dragOverSection, setDragOverSection] = useState<"task" | "note" | "painPoint" | null>(null);
  const [showRemark, setShowRemark] = useState(false);
  const [isEditingRemark, setIsEditingRemark] = useState(false);

  const updateField = <K extends keyof Project>(
    field: K,
    value: Project[K]
  ) => {
    onUpdate({ ...project, [field]: value });
  };

  // --- Tasks (with auto-status) ---

  const updateTasksWithAutoStatus = (newTasks: Task[]) => {
    const newStatus = computeAutoStatus(newTasks, project.status);
    onUpdate({ ...project, tasks: newTasks, status: newStatus });
  };

  const addTask = (text: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };
    console.log("[ProjectCard:addTask]", {
      projectId: project.id,
      taskId: newTask.id,
    });
    updateTasksWithAutoStatus([...project.tasks, newTask]);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const newTasks = project.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates } : t
    );
    updateTasksWithAutoStatus(newTasks);
  };

  const deleteTask = (taskId: string) => {
    console.log("[ProjectCard:deleteTask]", {
      projectId: project.id,
      taskId,
    });
    updateTasksWithAutoStatus(
      project.tasks.filter((t) => t.id !== taskId)
    );
  };

  // --- Notes ---

  const addNote = (text: string) => {
    const newNote: TextItem = {
      id: crypto.randomUUID(),
      text,
    };
    console.log("[ProjectCard:addNote]", {
      projectId: project.id,
      noteId: newNote.id,
    });
    updateField("notes", [...project.notes, newNote]);
  };

  const updateNote = (noteId: string, text: string) => {
    updateField(
      "notes",
      project.notes.map((n) =>
        n.id === noteId ? { ...n, text } : n
      )
    );
  };

  const deleteNote = (noteId: string) => {
    console.log("[ProjectCard:deleteNote]", {
      projectId: project.id,
      noteId,
    });
    updateField(
      "notes",
      project.notes.filter((n) => n.id !== noteId)
    );
  };

  // --- Pain Points ---

  const addPainPoint = (text: string) => {
    const newPainPoint: TextItem = {
      id: crypto.randomUUID(),
      text,
    };
    console.log("[ProjectCard:addPainPoint]", {
      projectId: project.id,
      painPointId: newPainPoint.id,
    });
    updateField("painPoints", [...project.painPoints, newPainPoint]);
  };

  const updatePainPoint = (painPointId: string, text: string) => {
    updateField(
      "painPoints",
      project.painPoints.map((p) =>
        p.id === painPointId ? { ...p, text } : p
      )
    );
  };

  const deletePainPoint = (painPointId: string) => {
    console.log("[ProjectCard:deletePainPoint]", {
      projectId: project.id,
      painPointId,
    });
    updateField(
      "painPoints",
      project.painPoints.filter((p) => p.id !== painPointId)
    );
  };

  // --- Drop zone handlers ---

  const handleDragOver = (e: { preventDefault: () => void; dataTransfer: DataTransfer }, sectionType: "task" | "note" | "painPoint") => {
    if (!dragState) return;
    if (dragState.type !== sectionType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSection(sectionType);
  };

  const handleDragLeave = (e: { relatedTarget: EventTarget | null; currentTarget: EventTarget }) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && (e.currentTarget as Node).contains(relatedTarget)) {
      return;
    }
    setDragOverSection(null);
  };

  const handleDrop = (e: { preventDefault: () => void }, sectionType: "task" | "note" | "painPoint") => {
    e.preventDefault();
    setDragOverSection(null);

    if (!dragState) return;
    if (dragState.type !== sectionType) return;

    console.log("[ProjectCard:drop]", {
      type: sectionType,
      itemId: dragState.itemId,
      sourcePersonId: dragState.sourcePersonId,
      sourceProjectId: dragState.sourceProjectId,
      targetPersonId: personId,
      targetProjectId: project.id,
    });

    onMoveItem(
      dragState.sourcePersonId,
      dragState.sourceProjectId,
      sectionType,
      dragState.itemId,
      personId,
      project.id,
    );

    dragState = null;
  };

  const dropZoneHighlight = "ring-2 ring-blue-7 ring-inset rounded";

  const statusLabel =
    STATUS_OPTIONS.find((s) => s.value === project.status)?.label ??
    project.status;

  return (
    <div className="w-[280px] shrink-0 rounded-lg border border-gray-a6 bg-gray-a2 flex flex-col">
      {/* Header: Project name + status + delete */}
      <div className="px-3 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-1">
          {isEditingName ? (
            <Input
              value={project.name}
              onChange={(e) => updateField("name", e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (onSyncProjectName && nameBeforeEdit && project.name && nameBeforeEdit !== project.name) {
                  onSyncProjectName(nameBeforeEdit, project.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsEditingName(false);
                  if (onSyncProjectName && nameBeforeEdit && project.name && nameBeforeEdit !== project.name) {
                    onSyncProjectName(nameBeforeEdit, project.name);
                  }
                }
              }}
              autoFocus
              className="h-7 text-sm font-semibold px-1.5 flex-1 min-w-0"
            />
          ) : (
            <span
              className="text-sm font-semibold text-gray-12 cursor-text leading-7 flex-1 min-w-0 break-words"
              onClick={() => {
                setNameBeforeEdit(project.name);
                setIsEditingName(true);
              }}
            >
              {project.name || "Untitled Project"}
            </span>
          )}
          <Button
            variant="transparent"
            size="small"
            iconOnly
            onClick={() => setShowRemark((prev) => !prev)}
            className="shrink-0 opacity-50 hover:opacity-100"
          >
            <StickyNoteIcon className={`size-3 ${project.remark ? "text-amber-10" : "text-gray-9"}`} />
          </Button>
          <Button
            variant="transparent"
            size="small"
            iconOnly
            onClick={onDelete}
            className="shrink-0 opacity-50 hover:opacity-100"
          >
            <XIcon className="size-3.5 text-gray-9" />
          </Button>
        </div>

        {/* Hidden remark */}
        {showRemark && (
          <div>
            {isEditingRemark ? (
              <Input
                value={project.remark ?? ""}
                onChange={(e) => updateField("remark", e.target.value || undefined)}
                onBlur={() => setIsEditingRemark(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingRemark(false);
                }}
                autoFocus
                placeholder="Add a private remark..."
                className="h-6 text-xs px-1.5 bg-amber-a2"
              />
            ) : (
              <span
                className="text-xs text-amber-11 italic cursor-text block break-words"
                onClick={() => setIsEditingRemark(true)}
              >
                {project.remark || "Add a private remark..."}
              </span>
            )}
          </div>
        )}

        {/* Status select */}
        <Select
          value={project.status}
          onValueChange={(value) =>
            updateField("status", value as ProjectStatus)
          }
        >
          <SelectTrigger variant="transparent" size="small" className="h-6 px-1.5 w-fit max-w-full">
            <div className="flex items-center gap-1.5">
              <CircleIcon
                className={`size-2.5 shrink-0 ${getStatusColor(project.status)}`}
              />
              <span
                className={`text-xs px-1 py-0.5 rounded ${getStatusBadgeClasses(project.status)}`}
              >
                {statusLabel}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <CircleIcon
                  className={`size-2.5 ${getStatusColor(opt.value)}`}
                />
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Tasks */}
      <div
        className={`px-3 py-2 flex flex-col gap-1 ${dragOverSection === "task" ? dropZoneHighlight : ""}`}
        onDragOver={(e) => handleDragOver(e, "task")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "task")}
      >
        <span className="text-xs font-medium text-gray-10">Tasks</span>
        {project.tasks.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {project.tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={(checked) =>
                  updateTask(task.id, { completed: checked })
                }
                onUpdateText={(text) => updateTask(task.id, { text })}
                onDelete={() => deleteTask(task.id)}
                personId={personId}
                projectId={project.id}
              />
            ))}
          </div>
        )}
        <NewItemInput onAdd={addTask} placeholder="Add a task..." />
      </div>

      <Separator />

      {/* Notes */}
      <div
        className={`px-3 py-2 flex flex-col gap-1 ${dragOverSection === "note" ? dropZoneHighlight : ""}`}
        onDragOver={(e) => handleDragOver(e, "note")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "note")}
      >
        <Label className="text-xs font-medium text-gray-10">Notes</Label>
        {project.notes.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {project.notes.map((note) => (
              <TextItemRow
                key={note.id}
                item={note}
                onUpdateText={(text) => updateNote(note.id, text)}
                onDelete={() => deleteNote(note.id)}
                personId={personId}
                projectId={project.id}
                itemType="note"
              />
            ))}
          </div>
        )}
        <NewItemInput onAdd={addNote} placeholder="Add a note..." />
      </div>

      <Separator />

      {/* Pain Points */}
      <div
        className={`px-3 py-2 pb-3 flex flex-col gap-1 ${dragOverSection === "painPoint" ? dropZoneHighlight : ""}`}
        onDragOver={(e) => handleDragOver(e, "painPoint")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "painPoint")}
      >
        <Label className="text-xs font-medium text-red-10">
          Pain Points
        </Label>
        {project.painPoints.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {project.painPoints.map((painPoint) => (
              <TextItemRow
                key={painPoint.id}
                item={painPoint}
                onUpdateText={(text) => updatePainPoint(painPoint.id, text)}
                onDelete={() => deletePainPoint(painPoint.id)}
                personId={personId}
                projectId={project.id}
                itemType="painPoint"
                textClassName="text-red-11"
              />
            ))}
          </div>
        )}
        <NewItemInput
          onAdd={addPainPoint}
          placeholder="Add a pain point..."
          className="bg-red-a2 placeholder:text-red-8"
        />
      </div>
    </div>
  );
}
