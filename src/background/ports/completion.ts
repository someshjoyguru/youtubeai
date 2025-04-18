import { error } from "console";
import { GoogleGenerativeAI } from "@google/generative-ai";

import type { PlasmoMessaging } from "@plasmohq/messaging";

const genAI = new GoogleGenerativeAI("AIzaSyDVCE2ZrOhnGrI-4QBWP2DCCvFYz5fLcrI"); 
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function generateContent(prompt: string, context: any) {
  const parsed = context.transcript.events
    .filter((x: { segs: any }) => x.segs)
    .map((x: { segs: any[] }) =>
      x.segs.map((y: { utf8: any }) => y.utf8).join(" ")
    )
    .join(" ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ");

  const USER_PROMPT = `${prompt}\n\nVideo Title: ${context.metadata.title}\nVideo Transcript: ${parsed}`;

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: USER_PROMPT }] }],
  });
  return result.stream;
}

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  let cumulativeData = "";

  const prompt = req.body.prompt;
  const context = req.body.context;

  try {
    const generationStream = await generateContent(prompt, context);

    for await (const chunk of generationStream) {
      const text = chunk.text();
      cumulativeData += text;
      res.send({ message: cumulativeData, error: "", isEnd: false });
    }

    res.send({ message: "END", error: "", isEnd: true });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.send({ error: "Something went wrong with the Gemini API." });
  }
};

export default handler;