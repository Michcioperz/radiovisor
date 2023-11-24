import { Temporal } from "npm:temporal-polyfill@0.1.1";
import { millis, ScheduleItem } from "../util.ts";
import { MINUTE, SECOND } from "$std/datetime/constants.ts";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export default function DrawSchedule(
  props: {
    allSources: string[];
    allItems: ScheduleItem[];
    originalNow: string;
  },
) {
  const { allItems, allSources, originalNow } = props;
  allItems.forEach((item) => {
    item.startTime = Temporal.Instant.fromEpochMilliseconds(
      item.startTimeMillis,
    ).toZonedDateTimeISO("Europe/Warsaw");
    item.endTime = Temporal.Instant.fromEpochMilliseconds(item.endTimeMillis!)
      .toZonedDateTimeISO("Europe/Warsaw");
  });
  const now = useSignal(Temporal.ZonedDateTime.from(originalNow));
  useEffect(() => {
    const timer = setInterval(() => {
      now.value = now.value.add(Temporal.Duration.from({ seconds: 10 }));
    }, 10 * SECOND);
    return () => clearInterval(timer);
  });
  const nowPlusOneMinute = now.value.add(
    Temporal.Duration.from({ minutes: 1 }),
  );
  const allTimes: Temporal.ZonedDateTime[] = [];
  const allTimeMillis = new Set();
  allItems.forEach((item) => {
    if (!allTimeMillis.has(item.startTimeMillis)) {
      allTimeMillis.add(item.startTimeMillis);
      allTimes.push(item.startTime);
    }
    if (
      item.endTime && item.endTimeMillis &&
      !allTimeMillis.has(item.endTimeMillis)
    ) {
      allTimeMillis.add(item.endTimeMillis);
      allTimes.push(item.endTime);
    }
  });
  const somethingStartsNow = allTimeMillis.has(millis(now.value));
  const somethingStartsInOneMinute = allTimeMillis.has(
    millis(nowPlusOneMinute),
  );
  allTimes.push(now.value);
  allTimes.push(nowPlusOneMinute);
  allTimes.sort((a, b) => millis(a) - millis(b));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "[date] min-content [time] min-content" +
          allSources.map((source) => `[${source}] 1fr`).join(" "),
        gridTemplateRows: "[header] min-content" +
          allTimes.map((time, idx, arr) =>
            `[t${millis(time)}] ${
              (idx === arr.length - 1 || now.value.since(time).sign > 0)
                ? "min-content"
                : `${arr[idx + 1].since(time).total("milliseconds")}fr`
            }`
          ).join(
            " ",
          ),
      }}
    >
      {allSources.map((source) => (
        <div style={{ gridColumn: source, gridRow: "header" }}>{source}</div>
      ))}
      {allTimes.map((
        time,
        idx,
        arr,
      ) => ((time.since(now.value).sign < 0 ||
        time.since(nowPlusOneMinute).sign > 0) &&
        (
          <>
            {(idx < 1 || (arr[idx - 1].day != time.day))
              ? (
                <div
                  style={{ gridColumn: "date", gridRow: `t${millis(time)}` }}
                >
                  {time.toPlainDate().toString()}
                </div>
              )
              : null}
            <div style={{ gridColumn: "time", gridRow: `t${millis(time)}` }}>
              {time.toPlainTime().toString()}
            </div>
          </>
        ))
      )}
      <div
        style={{
          background: "rgba(255, 0, 0, 0.25)",
          gridColumnStart: "1",
          gridColumnEnd: "-1",
          gridRowStart: `t${millis(now.value)}`,
          gridRowEnd: `t${millis(nowPlusOneMinute)}`,
        }}
      >
      </div>
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
            zIndex: item.endTimeMillis,
          }}
        >
          <strong>{item.title}</strong>
          <ul>
            {item.authors.map((author) => <li>{author}</li>)}
          </ul>
          <small style={{ whiteSpace: "pre-wrap" }}>
            {item.description}
            {/* {"\n"}{item.startTime.toString()}{"\n"}{item.endTime?.toString()} */}
          </small>
        </div>
      ))}
    </div>
  );
}
