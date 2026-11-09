import { db } from "../db";
import { Client, Question, logActivity, type ClientDoc } from "../models";
import { getPlan } from "../plans";
import { generateQuestions } from "./profile";

/** Top up a client's buyer questions to their plan limit. */
export async function fillQuestions(clientId: string) {
  await db();
  const client = await Client.findById(clientId).lean<ClientDoc>();
  const plan = getPlan(client?.plan);
  if (!client || !plan) throw new Error("Client has no plan");
  const existing = await Question.find({ clientId }).select("text active").lean();
  const active = existing.filter((q) => q.active).length;
  const need = plan.questions - active;
  if (need <= 0) return { added: 0 };
  const qs = await generateQuestions(
    { brand: client.name, category: client.category, description: client.description, location: client.location, audience: client.audience, competitors: client.competitors },
    need,
    existing.map((q) => q.text),
  );
  if (qs.length) await Question.insertMany(qs.map((q) => ({ clientId, text: q.text, intent: q.intent, active: true })));
  await logActivity(clientId, "tracking", `Added ${qs.length} buyer questions to daily tracking.`, "/app/questions");
  return { added: qs.length };
}
