import { Temporal } from "npm:temporal-polyfill@0.1.1";

export interface ScheduleItem {
  source: string;
  startTime: Temporal.ZonedDateTime;
  startTimeMillis: number;
  endTime?: Temporal.ZonedDateTime;
  endTimeMillis?: number;
  title: string;
  authors: string[];
  description: string;
  imageUrl: null | string;
}

export function millis(time: Temporal.ZonedDateTime): number {
  return time.toInstant().epochMilliseconds;
}

export function backfillEnds(schedule: ScheduleItem[]) {
  schedule.forEach((elem, idx, arr) => {
    if (idx < 1) return;

    const previous = arr[idx - 1];
    previous.endTime = elem.startTime;
    previous.endTimeMillis = millis(previous.endTime);
  });
}
