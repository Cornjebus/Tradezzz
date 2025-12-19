/**
 * Auth utilities for getting the current user from database
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import db, { User, UserSettings } from "./db";

export interface AuthenticatedUser {
  dbUser: User;
  clerkId: string;
  email: string;
  settings: UserSettings | null;
}

/**
 * Get the authenticated user from the database
 * Creates the user if they don't exist (first login)
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return null;
  }

  // Get Clerk user for email
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress || "";

  // Upsert user in database (creates if doesn't exist)
  const dbUser = await db.users.upsertFromClerk({ id: clerkId, email });

  if (!dbUser) {
    return null;
  }

  // Get user settings
  const settings = await db.userSettings.findByUserId(dbUser.id);

  return {
    dbUser,
    clerkId,
    email,
    settings,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
