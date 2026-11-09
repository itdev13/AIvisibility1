import { db } from "../db";
import { crawlSite } from "../audit/crawl";
import { runChecks } from "../audit/rules";
import { availableEngines, type EngineId } from "../engines";
import { analyzeAnswer } from "../analysis/mentions";
import { computeMetrics } from "../analysis/metrics";
import { FreeCheck } from "../models";
import { pool } from "../utils";
import { generateQuestions, inferProfile } from "./profile";

const FREE_ENGINES: EngineId[] = ["claude", "chatgpt", "gemini", "perplexity"];
const FREE_QUESTIONS = 8;

/**
 * Free site check: crawl → profile → buyer questions → ask the engines → score.
 * Progress is written to the document so the report page can stream it.
 */
export async function runFreeCheck(checkId: string) {
  await db();
  const check = await FreeCheck.findById(checkId);
  if (!check) throw new Error("Check not found");
  const step = async (s: string, progress: number) => {
    check.step = s;
    check.progress = progress;
    await check.save();
  };

  try {
    check.status = "running";
    await step("Reading your website", 5);
    const crawl = await crawlSite(check.url, 12);
    if (!crawl.home) throw new Error("We couldn't load that website. Check the address and try again.");

    await step("Working out what you do", 18);
    const profile = await inferProfile(check.url, crawl.home);
    check.brand = profile.brand;
    check.category = profile.category;
    check.location = profile.location;
    check.summary = profile.description;

    await step("Writing the questions your buyers ask AI", 28);
    const qs = (await generateQuestions({ ...profile }, FREE_QUESTIONS)).filter((q) => q.intent !== "brand").slice(0, FREE_QUESTIONS);
    check.questions = qs.map((q) => q.text);

    const engines = availableEngines(FREE_ENGINES).slice(0, 3);
    check.engines = engines.map((e) => e.id);
    if (!engines.length) throw new Error("No AI engines are configured on the server.");
    await step(`Asking ${engines.map((e) => e.label).join(", ")}`, 35);

    const brand = { name: profile.brand, domain: check.domain };
    const comps = profile.competitors.map((c) => ({ name: c.name, domain: c.domain }));
    const tasks = check.questions.flatMap((q) => engines.map((e) => ({ q, e })));
    let done = 0;
    const results = await pool(tasks, 6, async ({ q, e }) => {
      try {
        const ans = await e.ask(q, { location: profile.location || undefined });
        const a = await analyzeAnswer(ans, brand, comps);
        return { question: q, engine: e.id, mentioned: a.mentioned, position: a.position ?? 0, brandsRanked: a.brandsRanked.slice(0, 10), citations: a.citations.slice(0, 8), excerpt: ans.text.slice(0, 1200), cited: a.cited, competitorMentions: a.competitorMentions, error: "" };
      } catch (err) {
        return { question: q, engine: e.id, mentioned: false, position: 0, brandsRanked: [], citations: [], excerpt: "", cited: false, competitorMentions: [], error: String((err as Error).message) };
      } finally {
        done++;
        if (done % 3 === 0) await FreeCheck.updateOne({ _id: check._id }, { progress: 35 + Math.round((done / tasks.length) * 50), step: `Asking AI engines (${done}/${tasks.length})` });
      }
    });

    await step("Checking your site's AI readiness", 88);
    const audit = runChecks(crawl);

    // Who AI recommends instead: count every brand named across answers.
    const counts = new Map<string, number>();
    for (const r of results) for (const b of r.brandsRanked) if (b.toLowerCase() !== profile.brand.toLowerCase()) counts.set(b, (counts.get(b) ?? 0) + 1);

    const m = computeMetrics(
      results.map((r) => ({ engine: r.engine, mentioned: r.mentioned, position: r.position || null, cited: r.cited, competitorMentions: r.competitorMentions, error: r.error })),
      comps.map((c) => c.name),
    );

    check.results = results.filter((r) => !r.error).map(({ cited, competitorMentions, error, ...r }) => r) as any;
    check.score = m.score;
    check.visibility = m.visibility;
    check.rivals = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
    check.checks = audit.checks as any;
    check.readiness = audit.score;
    check.status = "done";
    await step("Done", 100);
  } catch (err) {
    check.status = "failed";
    check.error = String((err as Error).message).slice(0, 300);
    await check.save();
    throw err;
  }
}
