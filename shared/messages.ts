import { z } from 'zod';

const join = z.strictObject({
  type: z.literal('join'),
  roomId: z.string().min(1),
  playerName: z.string().trim().min(1).max(30),
  protocolMode: z.enum(['binary', 'json']).optional(),
});
const chat = z.strictObject({
  type: z.literal('chat'),
  text: z.string().trim().min(1).max(500),
});
const input = z.strictObject({
  type: z.literal('input'),
  seq: z.number().int().safe().positive(),
  thrust: z.boolean(), backward: z.boolean(),
  left: z.boolean(), right: z.boolean(), fire: z.boolean(),
});
const ping = z.strictObject({
  type: z.literal('ping'), id: z.number().int().safe().nonnegative(),
});
export const clientMessageSchema = z.discriminatedUnion('type', [join, chat, input, ping]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export function parseClientMessage(raw: unknown): ClientMessage {
  return clientMessageSchema.parse(raw);
}
export function messageType(message: ClientMessage): string {
  switch (message.type) {
    case 'join': return 'join';
    case 'chat': return 'chat';
    case 'input': return 'input';
    case 'ping': return 'ping';
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}
