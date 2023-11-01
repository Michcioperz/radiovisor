import { defineRoute } from "$fresh/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.42/deno-dom-wasm.ts";
import { Temporal } from "npm:temporal-polyfill@0.1.1";
import zip from "https://deno.land/x/lodash@4.17.15-es/zip.js";
import { backfillEnds, millis, ScheduleItem } from "../../util.ts";

interface R357RamowkaJson {
  document: string;
}

const timeZone = "Europe/Warsaw";
export async function schedule(): Promise<ScheduleItem[]> {
  const upstreamResp = await fetch("https://radio357.pl/xhr/ramowka/");
  const upstreamJson: R357RamowkaJson = await upstreamResp.json();
  const domParser = new DOMParser();
  const document = domParser.parseFromString(
    upstreamJson.document,
    "text/html",
  )!;
  const nav = document.getElementById("scheduleNav");
  if (nav === null) throw new Error("missing scheduleNav");
  const list = document.getElementById("scheduleList");
  if (list === null) throw new Error("missing scheduleList");
  const expectedDays = 7;
  const dateElements = nav.getElementsByClassName("scheduleDate");
  const scheduleElements = list.getElementsByClassName("swiper-slide");
  if (
    (dateElements.length !== scheduleElements.length) ||
    (dateElements.length < expectedDays)
  ) {
    throw new Error(
      `there are ${dateElements.length} headers and ${scheduleElements.length} schedules, where at least ${expectedDays} was expected`,
    );
  }
  const today = Temporal.Now.plainDateISO(timeZone);
  const oneDay = Temporal.Duration.from({ days: 1 });
  const firstDateString = dateElements[0].innerText;
  if (firstDateString.match(/^\d\d.\d\d$/) === null) {
    throw new Error(`unexpected date format ${firstDateString}`);
  }
  const firstDateDay = parseInt(firstDateString.slice(0, 2));
  const firstDateMonth = parseInt(firstDateString.slice(3, 5));
  let firstDate = today;
  while (
    today.since(firstDate).abs().total("days") < 7 &&
    (firstDate.day !== firstDateDay ||
      firstDate.month !== firstDateMonth)
  ) {
    firstDate = firstDate.subtract(oneDay);
  }

  const dates = [...new Array(scheduleElements.length).keys()].map((_, i) =>
    firstDate.add(Temporal.Duration.from({ days: i }))
  );
  const elements: ScheduleItem[] =
    (zip(dates, scheduleElements) as [Temporal.PlainDate, Element][]).flatMap(
      ([date, schedule]) => {
        const podcastElements: HTMLDivElement[] = Array.from(
          schedule.querySelectorAll("div.podcastElement"),
        );
        const { year, month, day } = date;
        const firstHourOfDay = parseInt(podcastElements[0].dataset.hour ?? "");
        const podcasts = podcastElements.map((element) => {
          const hour = parseInt(element.dataset.hour ?? "");
          const overflow = hour < firstHourOfDay;
          const startTime = Temporal.ZonedDateTime.from({
            timeZone,
            year,
            month,
            day,
            hour,
          }).add(Temporal.Duration.from({ days: overflow ? 1 : 0 }));
          const startTimeMillis = millis(startTime);
          const body: HTMLDivElement | null = element.querySelector(
            "div.podcastBody",
          );
          if (body === null) throw new Error("missing podcast body");
          const title = body.dataset.title ?? "";
          const authorsElement: HTMLElement | null = body.querySelector(
            ".podcastAuthor",
          );
          if (authorsElement === null) {
            throw new Error("missing podcast authors");
          }
          const authors = authorsElement.innerText.split(",").map((s) =>
            s.trim()
          );
          const descElement: HTMLElement | null = body.querySelector(
            ".podcastDesc",
          );
          const description = descElement !== null
            ? descElement.innerText.trim()
            : "";
          const imageUrl = body.querySelector("img").dataset.src;
          return {
            source: "r357",
            startTime,
            startTimeMillis,
            title,
            authors,
            description,
            imageUrl,
          };
        });
        return podcasts;
      },
    );
  backfillEnds(elements);
  return elements;
}

export default defineRoute(async (_req, _ctx) => {
  return new Response(JSON.stringify(await schedule()), {
    headers: { "content-type": "application/json" },
  });
});
