import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@glaze/core/components";

interface WeekCalendarProps {
  currentWeekId: string;
  onSelectWeek: (weekId: string) => void;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  weekId: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
}

interface CalendarWeek {
  weekId: string;
  days: CalendarDay[];
}

function buildCalendarWeeks(year: number, month: number): CalendarWeek[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // First day of the month
  const firstOfMonth = new Date(year, month, 1);
  // Day of week for the 1st (0=Mon .. 6=Sun)
  const firstDow = (firstOfMonth.getDay() + 6) % 7;

  // Start from the Monday of the first week
  const startDate = new Date(year, month, 1 - firstDow);

  const weeks: CalendarWeek[] = [];
  const current = new Date(startDate);

  // Generate enough weeks to cover the month
  for (let w = 0; w < 6; w++) {
    const days: CalendarDay[] = [];
    let weekId = "";

    for (let d = 0; d < 7; d++) {
      const date = new Date(current);
      if (d === 0) {
        weekId = getISOWeekId(date);
      }
      const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      days.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
        isToday: dateStr === todayStr,
        weekId,
        dayOfWeek: d,
      });
      current.setDate(current.getDate() + 1);
    }

    // Only include rows that have at least one day in the current month
    if (days.some((d) => d.isCurrentMonth)) {
      weeks.push({ weekId, days });
    }
  }

  return weeks;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function WeekCalendar({ currentWeekId, onSelectWeek }: WeekCalendarProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [hoveredWeekId, setHoveredWeekId] = useState<string | null>(null);

  const weeks = buildCalendarWeeks(viewYear, viewMonth);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleWeekClick = (weekId: string) => {
    console.log("[WeekCalendar:selectWeek]", { weekId });
    onSelectWeek(weekId);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Month header */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={goToPrevMonth}
        >
          <ChevronLeftIcon className="size-3.5 text-gray-10" />
        </Button>
        <span className="text-xs font-semibold text-blue-10 uppercase tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button
          variant="transparent"
          size="small"
          iconOnly
          onClick={goToNextMonth}
        >
          <ChevronRightIcon className="size-3.5 text-gray-10" />
        </Button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {DAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="text-[10px] font-medium text-gray-9 py-0.5"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-px">
        {weeks.map((week) => {
          const isSelected = week.weekId === currentWeekId;
          const isHovered = week.weekId === hoveredWeekId;

          return (
            <div
              key={week.weekId}
              className={`grid grid-cols-7 text-center cursor-pointer rounded-md transition-colors ${
                isSelected
                  ? "bg-blue-a3"
                  : isHovered
                    ? "bg-gray-a3"
                    : ""
              }`}
              onMouseEnter={() => setHoveredWeekId(week.weekId)}
              onMouseLeave={() => setHoveredWeekId(null)}
              onClick={() => handleWeekClick(week.weekId)}
            >
              {week.days.map((day, i) => {
                const isWeekday = day.dayOfWeek < 5; // Mon-Fri
                const showHighlight = isWeekday && (isSelected || isHovered);

                return (
                  <span
                    key={i}
                    className={`text-[11px] py-1 leading-tight rounded-sm transition-colors ${
                      day.isToday
                        ? "bg-red-9 text-gray-1 font-bold rounded-full"
                        : !day.isCurrentMonth
                          ? "text-gray-7"
                          : showHighlight
                            ? isSelected
                              ? "text-blue-11 font-medium"
                              : "text-gray-12 font-medium"
                            : !isWeekday
                              ? "text-gray-9"
                              : "text-gray-12"
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
