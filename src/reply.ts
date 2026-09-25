import { Message, TextBlock } from "@strands-agents/sdk";

export function replyText(message: Message): string {
  return message.content
    .filter((block): block is TextBlock => block instanceof TextBlock)
    .map((block) => block.text)
    .join("");
}
