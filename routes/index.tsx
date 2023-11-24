import { schedule as scheduleRns } from "./api/rns.ts";
import { schedule as schedule357 } from "./api/r357.ts";
import { schedule as scheduleTokfm } from "./api/tokfm.ts";
import { Temporal } from "npm:temporal-polyfill@0.1.1";
import DrawSchedule from "../islands/DrawSchedule.tsx";

export default async function Home() {
  const schedules = await Promise.all([
    schedule357(),
    scheduleRns(),
    scheduleTokfm(),
  ]);
  const now = Temporal.Now.zonedDateTimeISO();
  const allItems = schedules.flatMap((schedule) =>
    schedule.filter((item) =>
      item.endTime && item.endTime.since(now).sign > 0 &&
      item.endTime.since(now).total("days") <= 1
    )
  );
  const earliestTime = allItems.map((item) => item.startTime).reduce(
    (previous, current) =>
      previous.since(current).sign < 0 ? previous : current,
    now,
  );
  schedules.flatMap((schedule) =>
    schedule.filter((item) =>
      item.endTime && now.since(item.endTime).sign >= 0 &&
      item.endTime.since(earliestTime).sign > 0
    )
  ).forEach((item) => allItems.push(item));
  allItems.sort((a, b) => a.startTime.since(b.startTime).sign);
  const allSources = Array.from(
    new Set(allItems.map((item) => item.source)),
  );
  allSources.sort();

  return <DrawSchedule allItems={allItems} originalNow={now.toString()} allSources={allSources} />;
}
