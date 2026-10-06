import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoonIcon, PanelLeftIcon, SunIcon, TableIcon } from "lucide-react";
import {
  Button,
  ButtonGroup,
  Input,
  Toolbar,
  ToolbarContent,
  ToolbarActions,
} from "@glaze/core/components";
import { useTheme } from "@glaze/core/hooks";
import { toast } from "sonner";

interface WeekHeaderProps {
  weekId: string;
  weekTitle?: string;
  sidebarOpen: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onTitleChange: (title: string) => void;
  onToggleSidebar: () => void;
  onViewRawData?: () => void;
}

export function formatWeekRange(weekId: string): string {
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

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const formatDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  return `Week ${formatDate(monday)} - ${formatDate(friday)}`;
}

export function WeekHeader({
  weekId,
  weekTitle,
  sidebarOpen,
  onPreviousWeek,
  onNextWeek,
  onTitleChange,
  onToggleSidebar,
  onViewRawData,
}: WeekHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { isDark, setTheme } = useTheme();
  const displayTitle = weekTitle || formatWeekRange(weekId);

  const handleToggleTheme = async () => {
    try {
      await setTheme(isDark ? "light" : "dark");
    } catch (error) {
      toast.error(`Failed to change theme: ${error}`);
    }
  };

  return (
    <Toolbar background="full-blur" inset={sidebarOpen ? "none" : "windowControls"}>
      <ToolbarContent>
        <div className="flex items-center gap-1.5">
          <Button variant="glass" size="large" iconOnly onClick={onToggleSidebar}>
            <PanelLeftIcon className="size-4.5 text-gray-11" />
          </Button>
          {isEditing ? (
            <Input
              value={weekTitle ?? ""}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditing(false);
              }}
              placeholder={formatWeekRange(weekId)}
              autoFocus
              className="h-7 text-sm font-semibold w-56"
            />
          ) : (
            <span
              className="text-sm font-semibold text-gray-12 cursor-text"
              onClick={() => setIsEditing(true)}
            >
              {displayTitle}
            </span>
          )}
        </div>
      </ToolbarContent>
      <ToolbarActions>
        <Button
          variant="glass"
          size="large"
          iconOnly
          onClick={handleToggleTheme}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {isDark ? (
            <SunIcon className="size-4.5 text-gray-11" />
          ) : (
            <MoonIcon className="size-4.5 text-gray-11" />
          )}
        </Button>
        {onViewRawData && (
          <Button variant="glass" size="large" iconOnly onClick={onViewRawData}>
            <TableIcon className="size-4.5 text-gray-11" />
          </Button>
        )}
        <ButtonGroup variant="glass" size="large">
          <Button iconOnly onClick={onPreviousWeek}>
            <ChevronLeftIcon className="size-4.5 text-gray-11" />
          </Button>
          <Button iconOnly onClick={onNextWeek}>
            <ChevronRightIcon className="size-4.5 text-gray-11" />
          </Button>
        </ButtonGroup>
      </ToolbarActions>
    </Toolbar>
  );
}
