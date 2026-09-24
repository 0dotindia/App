import "server-only";
import { db } from "@/lib/db";

// Read-only tools the personal assistant may call. Every executor takes the
// session user's id from the *server* (personal-assistant.ts binds it) —
// no tool schema has a userId/handle parameter, so the model can never be
// steered (or prompt-injected) into reading someone else's data. Nothing
// here writes, and nothing reads direct messages: message content is
// end-to-end encrypted at rest (message-crypto.ts) and is deliberately out
// of scope for the assistant, not merely omitted from this first version.
export type PersonalToolName = "get_my_profile" | "list_my_posts" | "list_my_articles" | "list_my_projects" | "get_my_notifications";

export type PersonalToolDefinition = {
  name: PersonalToolName;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

// Bounds keep one tool call from dumping an account into the prompt (cost,
// and a smaller blast radius if the model provider is ever the weak link).
const MAX_ITEMS = 10;
const POST_BODY_CHARS = 500;
const LONG_BODY_CHARS = 400;

const queryProp = {
  query: { type: "string", description: "Optional case-insensitive text to match. Omit to list the most recent items." },
  limit: { type: "integer", minimum: 1, maximum: MAX_ITEMS, description: `How many items to return (max ${MAX_ITEMS}).` },
};

export const PERSONAL_TOOLS: PersonalToolDefinition[] = [
  {
    name: "get_my_profile",
    description: "The signed-in user's own profile: display name, @handle, bio, follower/following counts, skills, and work experience.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_posts",
    description: "The user's own recent posts (not deleted), newest first. Use `query` to find posts about a topic.",
    input_schema: { type: "object", properties: queryProp },
  },
  {
    name: "list_my_articles",
    description: "The user's own articles, including drafts and private ones, newest first. Returns title, status, visibility and an excerpt.",
    input_schema: { type: "object", properties: queryProp },
  },
  {
    name: "list_my_projects",
    description: "The user's own portfolio projects with status, summary and description excerpt.",
    input_schema: { type: "object", properties: queryProp },
  },
  {
    name: "get_my_notifications",
    description: "The user's most recent notifications, with a count of unread ones. Types only — no message contents.",
    input_schema: { type: "object", properties: { unreadOnly: { type: "boolean", description: "Only unread notifications." } } },
  },
];

function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : MAX_ITEMS;
  return Math.min(Math.max(n, 1), MAX_ITEMS);
}

function queryOf(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 100) : null;
}

function excerpt(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Returns a JSON string (tool_result content). Unknown tool names and
// malformed input come back as an error string the model can read, never a
// thrown exception that would abort the whole chat turn.
export async function runPersonalTool(userId: string, name: string, input: unknown): Promise<string> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  switch (name as PersonalToolName) {
    case "get_my_profile": {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          username: { select: { handle: true } },
          profile: {
            select: {
              displayName: true,
              bio: true,
              followerCount: true,
              followingCount: true,
              isVerified: true,
              skills: { orderBy: { position: "asc" }, take: 30, select: { name: true } },
              workExperiences: {
                orderBy: { position: "asc" },
                take: 10,
                select: { title: true, company: true, startDate: true, endDate: true },
              },
            },
          },
        },
      });
      if (!user?.profile) return JSON.stringify({ error: "No profile yet." });
      return JSON.stringify({
        handle: user.username?.handle ?? null,
        displayName: user.profile.displayName,
        bio: user.profile.bio,
        verified: user.profile.isVerified,
        followers: user.profile.followerCount,
        following: user.profile.followingCount,
        skills: user.profile.skills.map((s) => s.name),
        workExperience: user.profile.workExperiences.map((w) => ({
          title: w.title,
          company: w.company,
          from: w.startDate.toISOString().slice(0, 10),
          to: w.endDate ? w.endDate.toISOString().slice(0, 10) : "present",
        })),
      });
    }

    case "list_my_posts": {
      const q = queryOf(args.query);
      const posts = await db.post.findMany({
        where: { authorId: userId, deletedAt: null, ...(q ? { body: { contains: q } } : {}) },
        orderBy: { createdAt: "desc" },
        take: clampLimit(args.limit),
        select: { body: true, createdAt: true, likeCount: true, replyCount: true, repostCount: true, postType: true },
      });
      return JSON.stringify(
        posts.map((p) => ({
          text: excerpt(p.body, POST_BODY_CHARS),
          at: p.createdAt.toISOString(),
          likes: p.likeCount,
          replies: p.replyCount,
          reposts: p.repostCount,
          type: p.postType,
        })),
      );
    }

    case "list_my_articles": {
      const q = queryOf(args.query);
      const articles = await db.article.findMany({
        where: {
          authorId: userId,
          ...(q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: clampLimit(args.limit),
        select: { title: true, subtitle: true, status: true, visibility: true, body: true, updatedAt: true, viewCount: true },
      });
      return JSON.stringify(
        articles.map((a) => ({
          title: a.title,
          subtitle: a.subtitle,
          status: a.status,
          visibility: a.visibility,
          excerpt: excerpt(a.body, LONG_BODY_CHARS),
          updatedAt: a.updatedAt.toISOString(),
          views: a.viewCount,
        })),
      );
    }

    case "list_my_projects": {
      const q = queryOf(args.query);
      const projects = await db.project.findMany({
        where: {
          ownerId: userId,
          ...(q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { description: { contains: q } }] } : {}),
        },
        orderBy: { position: "asc" },
        take: clampLimit(args.limit),
        select: { title: true, summary: true, description: true, status: true, visibility: true },
      });
      return JSON.stringify(
        projects.map((p) => ({
          title: p.title,
          summary: p.summary,
          status: p.status,
          visibility: p.visibility,
          excerpt: excerpt(p.description, LONG_BODY_CHARS),
        })),
      );
    }

    case "get_my_notifications": {
      const unreadOnly = args.unreadOnly === true;
      const [unreadCount, items] = await Promise.all([
        db.notification.count({ where: { recipientId: userId, readAt: null } }),
        db.notification.findMany({
          where: { recipientId: userId, ...(unreadOnly ? { readAt: null } : {}) },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { type: true, subjectType: true, readAt: true, createdAt: true },
        }),
      ]);
      return JSON.stringify({
        unreadCount,
        recent: items.map((n) => ({ type: n.type, about: n.subjectType, read: n.readAt !== null, at: n.createdAt.toISOString() })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
