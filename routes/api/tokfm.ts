import { defineRoute } from "$fresh/server.ts";
import { Temporal } from "npm:temporal-polyfill@0.1.1";
import { backfillEnds, ScheduleItem } from "../../util.ts";

interface TokfmGetschJson {
  schedule: (TokfmPastScheduleJson | TokfmLiveScheduleJson)[];
  active_program_info: TokfmActiveProgramInfoJson;
}

type TokfmActiveProgramInfoJson = unknown;

interface TokfmPastScheduleJson {
  podcast_id: `${number}`;
  podcast_img: string;
  series_url: string;
  emission_time: `${number}:${number}`;
  podcast_url: string;
  series_name: string;
  slider_title: string;
  podcast_name: string;
  in_user_playlist: 0 | 1;
  only_for_premium: 0 | 1;
  podcast_free: 0 | 1;
  podcast_without_ads: 0 | 1;
  temporary: boolean;
  premium_user: boolean;
  user_id: number;
  podcast_only_in_internet: 0 | 1;
  podcast_time: `${number}`;
  podcast_index: null | unknown;
  guests: null | unknown;
  leaders: null | unknown;
}

interface TokfmLiveScheduleJson {
  playing: boolean;
  debug: `${number}/${number}/${number}/${number}`;
  start_time: `${number}:${number}`;
  end_time: `${number}:${number}`;
  series_name: string;
  slider_title: string;
  series_url: string;
  series_id: `${number}`;
  podcast_name: "" | string;
  leader_email: "" | string;
  leader_img: string;
}

const timeZone = "Europe/Warsaw";
export async function schedule(): Promise<ScheduleItem[]> {
  const upstreamResp = await fetch("https://audycje.tokfm.pl/getsch?ver=2021");
  const upstreamJson: TokfmGetschJson = await upstreamResp.json();
  const { year, month, day } = Temporal.Now.plainDateISO(timeZone);
  const elements: ScheduleItem[] = upstreamJson.schedule.map((schedule) => {
    const startTimeString = "start_time" in schedule
      ? schedule.start_time
      : schedule.emission_time;
    const hour = parseInt(startTimeString.slice(0, 2));
    const minute = parseInt(startTimeString.slice(3, 5));
    const startTime = Temporal.ZonedDateTime.from({
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
    });
    const startTimeMillis = startTime.toInstant().epochMilliseconds;
    const title = schedule.slider_title;
    const description = schedule.podcast_name;
    const authors = "leader_email" in schedule && schedule.leader_email
      ? [schedule.leader_email]
      : [];
    const imageUrl = "leader_img" in schedule
      ? schedule.leader_img
      : schedule.podcast_img;
    return {
      source: "tokfm",
      title,
      startTime,
      startTimeMillis,
      authors,
      description,
      imageUrl,
    };
  });
  elements.sort((a, b) => a.startTime.since(b.startTime).sign);
  backfillEnds(elements);
  return elements;
}

export default defineRoute(async (_req, _ctx) => {
  return new Response(JSON.stringify(await schedule()), {
    headers: { "content-type": "application/json" },
  });
});
