// Notifications — real social events only.
//
// A notification is emitted from an actual action (a follow, a like, a comment)
// and never synthesized. Emission is best-effort: it must never break or roll
// back the action that triggered it, so callers fire-and-forget and we swallow
// errors here. Self-actions (liking your own post) produce nothing.

import "server-only";
import { prisma } from "./db";
import type { NotificationType } from "@prisma/client";

type EmitInput = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
};

export async function emitNotification({ recipientId, actorId, type, postId }: EmitInput): Promise<void> {
  // No notification for acting on your own content.
  if (recipientId === actorId) return;
  try {
    await prisma.notification.create({
      data: { userId: recipientId, actorId, type, postId: postId ?? null }
    });
  } catch {
    // Best-effort: a failed notification must not fail the underlying action.
  }
}
