import { CheckIcon } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@glaze/core/components";
import type { Person, WeekData, TextItem } from "../types";

interface UnfinishedProject {
  projectName: string;
  status: Person["projects"][number]["status"];
  tasks: string[];
  notes: TextItem[];
  painPoints: TextItem[];
}

interface UnfinishedPerson {
  name: string;
  projects: UnfinishedProject[];
}

export interface TransferPayload {
  people: UnfinishedPerson[];
}

/** Extract unfinished projects and their unfinished tasks from a week's data. */
export function getUnfinishedProjects(data: WeekData): TransferPayload | null {
  const people: UnfinishedPerson[] = [];

  for (const person of data.people) {
    const projects: UnfinishedProject[] = [];

    for (const project of person.projects) {
      if (project.status === "finished") continue;

      projects.push({
        projectName: project.name,
        status: project.status,
        tasks: project.tasks
          .filter((task) => !task.completed)
          .map((task) => task.text),
        notes: project.notes,
        painPoints: project.painPoints,
      });
    }

    if (projects.length > 0) {
      people.push({ name: person.name, projects });
    }
  }

  return people.length > 0 ? { people } : null;
}

/** Merge transferred projects into the current week data.
 *  Same-named projects are merged (tasks added to existing project)
 *  rather than creating duplicate project cards.
 */
export function mergeTransfer(
  current: WeekData,
  payload: TransferPayload
): WeekData {
  const updated = {
    ...current,
    people: current.people.map((p) => ({
      ...p,
      projects: p.projects.map((pr) => ({
        ...pr,
        tasks: [...pr.tasks],
        notes: [...pr.notes],
        painPoints: [...pr.painPoints],
      })),
    })),
  };

  for (const transferPerson of payload.people) {
    // Find existing person by name (case-insensitive)
    const existingIdx = updated.people.findIndex(
      (p) => p.name.toLowerCase() === transferPerson.name.toLowerCase()
    );

    if (existingIdx >= 0) {
      const existingPerson = updated.people[existingIdx];

      for (const tp of transferPerson.projects) {
        // Check if person already has a project with the same name
        const existingProject = existingPerson.projects.find(
          (pr) => pr.name.toLowerCase() === tp.projectName.toLowerCase()
        );

        if (existingProject) {
          // Merge tasks into existing project
          const newTasks = tp.tasks.map((text) => ({
            id: crypto.randomUUID(),
            text,
            completed: false,
          }));
          existingProject.tasks.push(...newTasks);
          // Merge notes and pain points
          existingProject.notes.push(
            ...tp.notes.map((note) => ({ ...note, id: crypto.randomUUID() }))
          );
          existingProject.painPoints.push(
            ...tp.painPoints.map((painPoint) => ({
              ...painPoint,
              id: crypto.randomUUID(),
            }))
          );
        } else {
          // Add as new project
          existingPerson.projects.push({
            id: crypto.randomUUID(),
            name: tp.projectName,
            status: tp.status,
            tasks: tp.tasks.map((text) => ({
              id: crypto.randomUUID(),
              text,
              completed: false,
            })),
            notes: tp.notes.map((note) => ({
              ...note,
              id: crypto.randomUUID(),
            })),
            painPoints: tp.painPoints.map((painPoint) => ({
              ...painPoint,
              id: crypto.randomUUID(),
            })),
          });
        }
      }
    } else {
      // Add new person with all their projects
      updated.people.push({
        id: crypto.randomUUID(),
        name: transferPerson.name,
        projects: transferPerson.projects.map((tp) => ({
          id: crypto.randomUUID(),
          name: tp.projectName,
          status: tp.status,
          tasks: tp.tasks.map((text) => ({
            id: crypto.randomUUID(),
            text,
            completed: false,
          })),
          notes: tp.notes.map((note) => ({
            ...note,
            id: crypto.randomUUID(),
          })),
          painPoints: tp.painPoints.map((painPoint) => ({
            ...painPoint,
            id: crypto.randomUUID(),
          })),
        })),
      });
    }
  }

  return updated;
}

interface TransferDialogProps {
  open: boolean;
  payload: TransferPayload;
  previousWeekLabel: string;
  onTransfer: () => void;
  onSkip: () => void;
}

export function TransferDialog({
  open,
  payload,
  previousWeekLabel,
  onTransfer,
  onSkip,
}: TransferDialogProps) {
  const totalTasks = payload.people.reduce(
    (sum, p) => sum + p.projects.reduce((s, pr) => s + pr.tasks.length, 0),
    0
  );
  const totalProjects = payload.people.reduce(
    (sum, person) => sum + person.projects.length,
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onSkip();
      }}
    >
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>Unfinished Projects from Previous Week</DialogTitle>
          <DialogDescription>
            {previousWeekLabel} has {totalProjects} unfinished{" "}
            {totalProjects === 1 ? "project" : "projects"}
            {totalTasks > 0
              ? ` with ${totalTasks} unfinished ${totalTasks === 1 ? "task" : "tasks"}`
              : ""}
            . Transfer them to this week?
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {payload.people.map((person, pi) => (
            <div key={pi} className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-gray-12">
                {person.name}
              </span>
              {person.projects.map((project, pri) => (
                <div key={pri} className="flex flex-col gap-1 pl-2">
                  <span className="text-xs font-semibold text-gray-11">
                    {project.projectName}
                  </span>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {project.tasks.map((task, ti) => (
                      <div
                        key={ti}
                        className="flex items-center gap-1.5"
                      >
                        <Checkbox
                          checked={false}
                          disabled
                          className="shrink-0"
                        />
                        <span className="text-xs text-gray-11">
                          {task}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {pi < payload.people.length - 1 && <Separator />}
            </div>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="filled" onClick={onSkip}>
            Skip
          </Button>
          <Button variant="accent" onClick={onTransfer}>
            <CheckIcon className="size-4 text-gray-1" />
            Transfer All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
