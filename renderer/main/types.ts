export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TextItem {
  id: string;
  text: string;
}

export type ProjectStatus =
  | "backlog"
  | "todo"
  | "doing"
  | "finished";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
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

export interface WeekListItem {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  title?: string;
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

export const STATUS_OPTIONS: {
  value: ProjectStatus;
  label: string;
}[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "doing", label: "Doing" },
  { value: "finished", label: "Finished" },
];
