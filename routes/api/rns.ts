import { defineRoute } from "$fresh/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.42/deno-dom-wasm.ts";
import { Temporal } from "npm:temporal-polyfill@0.1.1";
import zip from "https://deno.land/x/lodash@4.17.15-es/zip.js";
import { backfillEnds, millis, ScheduleItem } from "../../util.ts";

const timeZone = "Europe/Warsaw";
const baseUrl = "https://nowyswiat.online/";
export async function schedule(): Promise<ScheduleItem[]> {
  const upstreamResp = await fetch(new URL("/ramowka", baseUrl));
  const upstreamBody = await upstreamResp.text();
  const domParser = new DOMParser();
  const document = domParser.parseFromString(upstreamBody, "text/html")!;
  const ramowka = document
    .querySelector(".uk-slideshow-schedule")!;
  const firstDateString: string =
    ramowka.querySelector(".rns-week-switcher-date").innerText;
  if (firstDateString.match(/^\d\d.\d\d$/) === null) {
    throw new Error(`unexpected date format ${firstDateString}`);
  }
  const today = Temporal.Now.plainDateISO(timeZone);
  const oneDay = Temporal.Duration.from({ days: 1 });
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
  const scheduleElements = Array.from(
    ramowka.querySelectorAll(".rns-switcher-list"),
  );

  const dates = [...new Array(scheduleElements.length).keys()].map((_, i) =>
    firstDate.add(Temporal.Duration.from({ days: i }))
  );

  const elements: ScheduleItem[] =
    (zip(dates, scheduleElements) as [Temporal.PlainDate, Element][]).flatMap(
      ([date, schedule]) => {
        const podcastElements: HTMLDivElement[] = Array.from(
          schedule.querySelectorAll(".rns-switcher-single"),
        );
        const { year, month, day } = date;
        const podcasts = podcastElements.map((element) => {
          const timeElement: HTMLElement = element.querySelector(
            ".rns-switcher-time",
          );
          const [hour, minute] = timeElement.innerText.trim().split(":").map((
            s,
          ) => parseInt(s));
          const startTime = Temporal.ZonedDateTime.from({
            timeZone,
            year,
            month,
            day,
            hour,
            minute,
          });
          const startTimeMillis = millis(startTime);
          const title = element.querySelector(".rns-switcher-title").innerText
            .trim();
          const body: HTMLElement = element.querySelector(
            ".rns-switcher-names",
          )!;
          const authors = [];
          let description = "";
          for (const item of body.childNodes) {
            if (
              description === "" && item.nodeType === item.TEXT_NODE &&
              ((item as Text).textContent.trim() === "" ||
                (item as Text).textContent.trim() === "|")
            ) {
              continue;
            }
            if (
              description === "" && item.nodeType === item.ELEMENT_NODE &&
              (item as HTMLElement).tagName === "A"
            ) {
              let author = (item as HTMLAnchorElement).innerText;
              if (author.endsWith(",")) {
                author = author.slice(0, author.length - 1);
              }
              authors.push(author);
              continue;
            }
            if (item.nodeType === item.ELEMENT_NODE && item.tagName === "BR") {
              description += "\n";
              continue;
            }
            description += item.textContent;
          }
          description = description.trim();
          const imageElement: HTMLImageElement = element.querySelector(
            "img.rns-switcher-img",
          );
          imageElement.getAttribute("src");
          const imageUrl = new URL(imageElement.getAttribute("src"), baseUrl);
          return {
            source: "rns",
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
