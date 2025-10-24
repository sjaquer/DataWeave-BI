
"use client";

import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-calendar-heatmap/dist/styles.css';

type HeatmapValue = {
  date: string;
  count: number; // Representa el nivel de cumplimiento (ej. 1=Rojo, 2=Amarillo, 3=Verde)
  tooltip: string;
};

export function PerformanceCalendar({ data }: { data: HeatmapValue[] }) {
  const today = new Date();
  
  const getClassForValue = (value: HeatmapValue | null) => {
    if (!value) {
      return 'color-empty';
    }
    switch (value.count) {
      case 1: return 'color-red';
      case 2: return 'color-yellow';
      case 3: return 'color-green';
      default: return 'color-empty';
    }
  };

  return (
    <div>
      <CalendarHeatmap
        startDate={new Date(today.getFullYear(), today.getMonth() - 5, 1)}
        endDate={today}
        values={data}
        classForValue={getClassForValue}
        tooltipDataAttrs={(value: HeatmapValue) => {
          return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': value.tooltip };
        }}
        showWeekdayLabels={true}
      />
      <ReactTooltip id="heatmap-tooltip" />
    </div>
  );
}
