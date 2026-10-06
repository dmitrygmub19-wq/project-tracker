import { useState } from "react";
import { PlusIcon, XIcon, StickyNoteIcon } from "lucide-react";
import { Button, Input, Separator } from "@glaze/core/components";
import type { Person, Project } from "../types";
import { ProjectCard } from "./ProjectCard";

interface PersonSectionProps {
  person: Person;
  onUpdate: (updated: Person) => void;
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

function createEmptyProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "",
    status: "backlog",
    tasks: [],
    notes: [],
    painPoints: [],
  };
}

export function PersonSection({
  person,
  onUpdate,
  onDelete,
  onMoveItem,
  onSyncProjectName,
}: PersonSectionProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [showRemark, setShowRemark] = useState(false);
  const [isEditingRemark, setIsEditingRemark] = useState(false);

  const updateName = (name: string) => {
    onUpdate({ ...person, name });
  };

  const updateRemark = (remark: string) => {
    onUpdate({ ...person, remark: remark || undefined });
  };

  const addProject = () => {
    const newProject = createEmptyProject();
    console.log("[PersonSection:addProject]", {
      personId: person.id,
      projectId: newProject.id,
    });
    onUpdate({
      ...person,
      projects: [...person.projects, newProject],
    });
  };

  const updateProject = (projectId: string, updated: Project) => {
    onUpdate({
      ...person,
      projects: person.projects.map((p) =>
        p.id === projectId ? updated : p
      ),
    });
  };

  const deleteProject = (projectId: string) => {
    console.log("[PersonSection:deleteProject]", {
      personId: person.id,
      projectId,
    });
    onUpdate({
      ...person,
      projects: person.projects.filter((p) => p.id !== projectId),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Person header */}
      <div className="flex items-center gap-2">
        {isEditingName ? (
          <Input
            value={person.name}
            onChange={(e) => updateName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditingName(false);
            }}
            autoFocus
            className="h-9 text-xl font-bold px-2 w-56"
          />
        ) : (
          <h2
            className="text-xl font-bold text-gray-12 cursor-text"
            onClick={() => setIsEditingName(true)}
          >
            {person.name || "Unnamed Person"}
          </h2>
        )}
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={() => setShowRemark((prev) => !prev)}
          className="opacity-50 hover:opacity-100"
        >
          <StickyNoteIcon className={`size-3.5 ${person.remark ? "text-amber-10" : "text-gray-9"}`} />
        </Button>
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={onDelete}
          className="opacity-50 hover:opacity-100"
        >
          <XIcon className="size-3.5 text-gray-9" />
        </Button>
      </div>

      {/* Hidden remark */}
      {showRemark && (
        <div className="ml-1 mb-1">
          {isEditingRemark ? (
            <Input
              value={person.remark ?? ""}
              onChange={(e) => updateRemark(e.target.value)}
              onBlur={() => setIsEditingRemark(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingRemark(false);
              }}
              autoFocus
              placeholder="Add a private remark..."
              className="h-7 text-xs px-2 w-80 bg-amber-a2"
            />
          ) : (
            <span
              className="text-xs text-amber-11 italic cursor-text inline-block min-w-[80px]"
              onClick={() => setIsEditingRemark(true)}
            >
              {person.remark || "Add a private remark..."}
            </span>
          )}
        </div>
      )}

      {/* Projects row: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 items-start">
        {person.projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            personId={person.id}
            onUpdate={(updated) => updateProject(project.id, updated)}
            onDelete={() => deleteProject(project.id)}
            onMoveItem={onMoveItem}
            onSyncProjectName={onSyncProjectName}
          />
        ))}

        {/* Add project button */}
        <Button
          variant="filled"
          size="small"
          onClick={addProject}
          className="shrink-0"
        >
          <PlusIcon className="size-3.5 text-gray-11" />
          Add Project
        </Button>
      </div>

      <Separator />
    </div>
  );
}
