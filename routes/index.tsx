import { schedule as scheduleRns } from "./api/rns.ts";
import { schedule as schedule357 } from "./api/r357.ts";
import { schedule as scheduleTokfm } from "./api/tokfm.ts";
import { Temporal } from "npm:temporal-polyfill@0.1.1";
import { millis } from "../util.ts";
import { MINUTE } from "$std/datetime/constants.ts";

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
  const allTimes: Temporal.ZonedDateTime[] = [];
  const allTimeMillis = new Set();
  allItems.forEach((item) => {
    if (!allTimeMillis.has(item.startTimeMillis)) {
      allTimeMillis.add(item.startTimeMillis);
      allTimes.push(item.startTime);
    }
  });
  allTimes.sort((a, b) => millis(a) - millis(b));
  const allSources = Array.from(
    new Set(allItems.map((item) => item.source)),
  );
  allSources.sort();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "[date] min-content [time] min-content" +
          allSources.map((source) => `[${source}] 1fr`).join(" "),
        gridTemplateRows: "[header] min-content" +
          allTimes.map((time, idx, arr) =>
            `[t${millis(time)}] ${
              idx === arr.length - 1
                ? 15 * MINUTE
                : arr[idx + 1].since(time).total("milliseconds")
            }fr`
          ).join(
            " ",
          ),
      }}
    >
      {allSources.map((source) => (
        <div style={{ gridColumn: source, gridRow: "header" }}>{source}</div>
      ))}
      {allTimes.map((time, idx, arr) => (
        <>
          {(idx < 1 || (arr[idx - 1].day != time.day))
            ? (
              <div style={{ gridColumn: "date", gridRow: `t${millis(time)}` }}>
                {time.toPlainDate().toString()}
              </div>
            )
            : null}
          <div style={{ gridColumn: "time", gridRow: `t${millis(time)}` }}>
            {time.toPlainTime().toString()}
          </div>
        </>
      ))}
      {allItems.map((item) => (
        <div
          style={{
            border: "1px solid black",
            gridColumn: item.source,
            gridRowStart: `t${item.startTimeMillis}`,
            gridRowEnd: `t${item.endTimeMillis}`,
            background: `rgba(255,255,255, 0.5) url(${item.imageUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          <strong>{item.title}</strong>
          <ul>
            {item.authors.map((author) => <li>{author}</li>)}
          </ul>
          {item.description}
        </div>
      ))}
    </div>
  );
}