import {
  page as _page,
  list as _list,
  section as _section,
  attr,
  node as _node,
} from "severus-scrape";
import _ from "lodash/fp.js";
import { inspect } from "util";
import { promises as fs, createWriteStream } from "fs";
import { default as fetch } from "node-fetch";

const BASE_URL = "https://theportalwiki.com";
const wikiUrl = (pageName) => `${BASE_URL}/wiki/${pageName}`;

const allPages = _page({
  url: wikiUrl("Category:Voice_lines"),
  scrape: _.flow(
    _list(
      "table tr td li",
      _section("a", {
        url: attr(null, "href"),
        title: attr(null, "title"),
      })
    ),
    _.filter((page) => page.title.endsWith("voice lines")),
    _.map((page) => ({
      title: page.title.replace(/\s+voice\s+lines$/, ""),
      url: page.url,
    }))
  ),
});

const voiceLinesPage = _page({
  url: (childUrl) => `${BASE_URL}${childUrl}`,
  scrape: _node(
    "#mw-content-text",
    (node) =>
      node.childNodes
        .filter((el) => el.tagName === "h3" || el.tagName === "ul")
        .map((el) =>
          el.tagName === "h3"
            ? { heading: el.rawText.trim() }
            : {
                list: el
                  .querySelectorAll("li")
                  .map((li) => ({
                    text: li.querySelector("i")?.rawText,
                    url: li.querySelector("a.internal")?.attributes.href,
                  }))
                  .filter(({ text, url }) => text && url),
              }
        )
        .reduce(
          ([current, sections], item) => {
            if (item.heading) {
              return [item.heading, { ...sections, [item.heading]: [] }];
            } else if (current) {
              return [
                current,
                {
                  ...sections,
                  [current]: [...(sections[current] ?? []), ...item.list],
                },
              ];
            }
            return [current, sections];
          },
          [null, {}]
        )[1]
  ),
});

async function doItAll() {
  console.log("Fetching voice categories...");
  const allCategories = await allPages.scrape();

  await fs.mkdir("out", { recursive: true });

  const toDownload = [];

  console.log("Enumerating all voice lines...");
  for (const { title, url } of allCategories) {
    console.log(`Enumerating voice lines for ${title}...`);
    const res = await voiceLinesPage.scrape(url);
    await fs.writeFile(
      `out/${_.camelCase(title)}.json`,
      JSON.stringify(res, null, 2),
      "utf8"
    );
    toDownload.push({ title, res });
  }

  for (const { title, res } of toDownload) {
    console.log(`Fetching audio files for ${title}...`);
    for (const [section, items] of Object.entries(res)) {
      console.log(`-> ${section}`);
      for (const item of items) {
        if (!item || !item.url || !item.text) continue;
        console.log(`  -> "${item.text}"`);
        const filename = _.camelCase(`${title}-${section}-${item.text}`);
        const response = await fetch(item.url);
        const file = createWriteStream(`out/${filename}.wav`);
        await new Promise((res, rej) => {
          response.body.pipe(file).on("error", rej).on("close", res);
        });
        console.log(`  -> written to ./out/${filename}.wav`);
      }
    }
  }
}

doItAll()
  .then((v) => inspect(v, { depth: Infinity, colors: true }))
  .then(console.log, console.error);
