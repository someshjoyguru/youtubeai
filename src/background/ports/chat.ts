import { error } from "console";
import { GoogleGenerativeAI } from "@google/generative-ai";

import type { PlasmoMessaging } from "@plasmohq/messaging";

const genAI = new GoogleGenerativeAI("AIzaSyDVCE2ZrOhnGrI-4QBWP2DCCvFYz5fLcrI");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const SYSTEM = `
You are a helpful assistant, Given the metadata and transcript of a YouTube video. Your primary task is to provide accurate and relevant answers to any questions based on this information. Use the available details effectively to assist users with their inquiries about the video's content, context, or any other related aspects.

START OF METADATA
Video Title: {title}
END OF METADATA

START OF TRANSCRIPT
{transcript}
END OF TRANSCRIPT
`;

async function createChatCompletion(
  modelName: string,
  messages: any[],
  context: any
) {
  const parsed = context.transcript.events
    .filter((x: { segs: any }) => x.segs)
    .map((x: { segs: any[] }) =>
      x.segs.map((y: { utf8: any }) => y.utf8).join(" ")
    )
    .join(" ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ");

  const SYSTEM_WITH_CONTEXT = SYSTEM.replace(
    "{title}",
    context.metadata.title
  ).replace("{transcript}", parsed);

  const geminiMessages = [
    { role: "user", parts: [{ text: SYSTEM_WITH_CONTEXT }] },
    ...messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
  ];

  console.log(geminiMessages);

  const result = await model.generateContentStream({
    contents: geminiMessages,
  });
  return result.stream;
}

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  let cumulativeData = "";

  const messages = req.body.messages;
  const model = "gemini-2.0-flash";
  const context = req.body.context;

  try {
    const generationStream = await createChatCompletion(model, messages, context);

    for await (const chunk of generationStream) {
      const text = chunk.text();
      cumulativeData += text;
      res.send({ message: cumulativeData, error: null, isEnd: false });
    }

    res.send({ message: "END", error: null, isEnd: true });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.send({ error: "something went wrong with the Gemini API." });
  }
};

export default handler;