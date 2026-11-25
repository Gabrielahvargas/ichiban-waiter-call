import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const INSTRUCTIONS = `You help restaurant staff fix TV remote (D-pad) navigation on a web page that shows waiter calls.
The page is a web app opened in a browser on the TV. In the app: arrow keys move a visible focus border between buttons,
OK/Enter activates, Back/Escape returns; the PIN keypad and menu should fit without scrolling. The app cannot stop a browser
that turns arrows into its own mouse pointer (common in TV Bro, Puffin, some built-in browsers); that must be fixed in the
browser/TV settings or by using another browser. The app must be the latest published version (reload the page).
Write concrete, numbered, step-by-step checks specific to the given TV brand/model and browser, ordered from most likely
to least likely, including exact Android TV menu paths when known, how to tell if the step worked, and what to try next.
Use plain, non-technical language. Reply in the same language as the user's description (Spanish if unclear).
Do not invent features of the app. Keep it under 350 words. Use Markdown with short headings and numbered lists.`;

export async function generateTvHelp(input: { tvModel: string; browser: string; problem: string; language: string }) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6.1-sol"),
    system: INSTRUCTIONS,
    maxRetries: 0,
    messages: [
      {
        role: "user",
        content: `App language: ${input.language}\nTV model: ${input.tvModel}\nBrowser/app: ${input.browser || "unknown"}\nProblem: ${input.problem}`,
      },
    ],
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}
