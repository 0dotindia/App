import { createCipheriv, randomBytes, randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { REPLIES } from "./seed-dots-data";
import {
  DAY, HOUR, MIN, SHOWCASE_HANDLE, chunk, dotSquareSvg, loadDots, loadShowcase, makeAfter, makeRng, openDb, ringsCoverSvg, type NotifRow,
} from "./seed-showcase-common";
import {
  AWARDS, CALENDAR, CERTIFICATES, DM_LINES, EDUCATION, IRA_REPLY_BACKS, LINKS, PAPERS, PERSON, POLLS, POSTS, QUESTIONS, REPLIES_TO_IRA, REPOS, SCALES, SHORT_LINKS, SKILLS, SOCIALS, THREAD_INTRO, THREAD_POSTS, WORK,
} from "./seed-showcase-data";

// Turns the platform account (@dot, "ZERO DOT") into the flagship example profile, in the platform's own voice:
// avatar + cover art, bio, Premium, emerald theme, links (featured + scheduled, with clicks), social links,
// capabilities (skills) with endorsements, milestones, certificates, awards, research papers, repositories,
// digital business card, portfolio layout, calendar, short links, follow top-ups, ~95 posts (photo posts, a
// 9-part scale thread, polls with votes, questions with accepted answers, mentions), replies, likes,
// reposts, bookmarks and encrypted DMs. Content, organisation and monetization come from the other
// seed-showcase-*.ts scripts. Run seed-dots.ts + seed-dots-platform.ts first, with the dev server STOPPED
// (it locks the SQLite file). There is no undo: back up prisma/dev.db first.
// Usage: npx tsx scripts/seed-showcase-profile.ts

function encryptAtRest(plaintext: string): string {
  const key = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

async function main() {
  const { url, prisma } = await openDb();
  const { rand, int, between, pick, chance, shuffle } = makeRng(Number(process.env.SEED ?? 12));
  const now = Date.now();
  const after = makeAfter(now, rand);
  const years = (n: number) => new Date(now - n * 365.25 * DAY);
  console.log(`Seeding the platform showcase profile @${SHOWCASE_HANDLE} at: ${url}`);

  try {
    const me = await loadShowcase(prisma);
    const dots = await loadDots(prisma);
    if ((await prisma.skill.count({ where: { profileId: me.profileId } })) > 0) {
      console.log(`@${SHOWCASE_HANDLE} already has the showcase profile (skills exist). Restore your DB backup to redo it.`);
      return;
    }
    const canEncrypt = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY ?? "", "base64").length === 32;
    mkdirSync("public/uploads", { recursive: true });

    // ================= Profile =================
    const createdAtMs = me.createdAt;
    writeFileSync(`public/uploads/showcase-${SHOWCASE_HANDLE}.svg`, dotSquareSvg("0dot", 5, "#0f7a5c", 512, "every dot matters"));
    writeFileSync(`public/uploads/showcase-${SHOWCASE_HANDLE}-cover.svg`, ringsCoverSvg(SCALES.map((s) => s.name)));
    const layout = ["projects", "skills", "resume", "papers", "repositories", "certificates", "awards", "connectedContent"].map((key) => ({ key, visible: true }));
    await prisma.profile.update({
      where: { id: me.profileId },
      data: {
        bio: PERSON.bio, avatarUrl: `/uploads/showcase-${SHOWCASE_HANDLE}.svg`, coverUrl: `/uploads/showcase-${SHOWCASE_HANDLE}-cover.svg`, themePreset: "emerald", isVerified: true, portfolioLayoutJson: JSON.stringify(layout),
      },
    });
    const years = (n: number) => new Date(now - n * 365.25 * DAY);
    await prisma.skill.createMany({ data: SKILLS.map((name, position) => ({ profileId: me.profileId, name, position })) });
    await prisma.workExperience.createMany({ data: WORK.map(([company, title, location, from, to, description], position) => ({ profileId: me.profileId, company, title, location, startDate: years(from), endDate: to === null ? null : years(to), description, position })) });
    await prisma.certificate.createMany({ data: CERTIFICATES.map(([title, issuingOrg, ago], i) => ({ profileId: me.profileId, title, issuingOrg, issueDate: years(ago), expiryDate: i === 4 ? new Date(now + 400 * DAY) : null, credentialId: `${issuingOrg.split(" ").map((w) => w[0]).join("")}-${between(100000, 999999)}`, credentialUrl: `https://credentials.example/${randomUUID().slice(0, 8)}` })) });
    await prisma.award.createMany({ data: AWARDS.map(([title, issuingOrg, ago, description]) => ({ profileId: me.profileId, title, issuingOrg, awardedDate: years(ago), description })) });
    await prisma.researchPaper.createMany({ data: PAPERS.map(([title, coauthors, venue, ago, abstract]) => ({ profileId: me.profileId, title, authors: `${PERSON.name}, ${coauthors}`, venue, publishDate: years(ago), doiOrUrl: `https://doi.example/10.9999/${randomUUID().slice(0, 8)}`, abstract })) });
    await prisma.gitRepository.createMany({ data: REPOS.map(([name, description, primaryLanguage, starCount]) => ({ profileId: me.profileId, provider: "github", url: `https://github.example/0dot/${name}`, displayName: name, description, primaryLanguage, starCount, lastSyncedAt: new Date(now - between(0, 6) * DAY) })) });
    await prisma.socialLink.createMany({ data: SOCIALS.map(([platform, url], position) => ({ profileId: me.profileId, platform, url, position })) });
    await prisma.digitalBusinessCard.upsert({ where: { profileId: me.profileId }, create: { profileId: me.profileId, enabled: true, includedFields: JSON.stringify(["bio", "workTitle", "email", "socialLinks"]) }, update: { enabled: true, includedFields: JSON.stringify(["bio", "workTitle", "email", "socialLinks"]) } });
    await prisma.calendarEntry.createMany({ data: CALENDAR.map(([title, inDays, hours]) => ({ profileId: me.profileId, title, startsAt: new Date(now + inDays * DAY), endsAt: new Date(now + inDays * DAY + hours * HOUR) })) });
    const ira = { id: me.id, profileId: me.profileId, skills: await prisma.skill.findMany({ where: { profileId: me.profileId }, select: { id: true, name: true } }) };

    // Links (one is scheduled, clicks recorded) and short links.
    const linkIds: string[] = [];
    for (const [i, [label, url, featured]] of LINKS.entries()) {
      const scheduled = label.startsWith("Fund");
      const link = await prisma.link.create({
        data: { profileId: ira.profileId, label, url, position: i, isFeatured: featured, clickCount: 0, startsAt: scheduled ? new Date(now - 10 * DAY) : null, endsAt: scheduled ? new Date(now + 40 * DAY) : null, createdAt: after([createdAtMs], createdAtMs, now - 60 * DAY) },
        select: { id: true },
      });
      linkIds.push(link.id);
      const clicks = between(60, 900) * (featured ? 2 : 1);
      await prisma.linkClick.createMany({ data: Array.from({ length: Math.min(clicks, 400) }, () => ({ linkId: link.id, occurredAt: new Date(now - rand() * 90 * DAY), referrerHost: pick(["twitter.com", "linkedin.com", "instagram.com", "wa.me", "youtube.com", null]) })) });
      await prisma.link.update({ where: { id: link.id }, data: { clickCount: clicks } });
    }
    for (const [code, dest] of SHORT_LINKS) {
      const sl = await prisma.shortLink.create({ data: { ownerId: ira.id, shortCode: `${SHOWCASE_HANDLE}_${code}`, destinationUrl: dest, clickCount: 0, createdAt: after([createdAtMs], createdAtMs, now - 30 * DAY) }, select: { id: true } });
      const clicks = between(80, 700);
      await prisma.shortLinkClick.createMany({ data: Array.from({ length: Math.min(clicks, 300) }, () => ({ shortLinkId: sl.id, occurredAt: new Date(now - rand() * 80 * DAY), referrerHost: pick(["twitter.com", "wa.me", "linkedin.com", null]) })) });
      await prisma.shortLink.update({ where: { id: sl.id }, data: { clickCount: clicks } });
    }

    // Premium subscription (yearly) with its charge, so the profile shows the Premium badge/theme.
    if ((await prisma.platformSubscription.count({ where: { subscriberProfileId: ira.profileId } })) === 0) {
      const premiumAt = new Date(now - 100 * DAY);
      await prisma.platformSubscription.create({ data: { subscriberType: "profile", subscriberProfileId: ira.profileId, plan: "profile_premium", status: "active", billingInterval: "yearly", processorSubscriptionId: `sub_seed_${randomBytes(8).toString("hex")}`, currentPeriodEnd: new Date(premiumAt.getTime() + 365 * DAY), createdAt: premiumAt } });
      await prisma.paymentTransaction.create({ data: { kind: "platform_subscription_charge", payerId: ira.id, amount: 60, currency: "usd", platformFee: 60, processor: "stripe_connect", processorReference: `in_seed_${randomBytes(8).toString("hex")}`, status: "succeeded", relatedObjectType: "platform_subscription", relatedObjectId: ira.id, createdAt: premiumAt } });
    }

    // ================= Follows (top-up: the dots already follow @dot from seed-dots-platform.ts) =================
    const notifs: NotifRow[] = [];
    const markRead = (at: Date) => (chance(0.55) ? new Date(at.getTime() + between(5, 600) * MIN) : null);
    const followRows: { followerId: string; followeeId: string; status: string; createdAt: Date }[] = [];
    const existingFollows = await prisma.follow.findMany({ where: { OR: [{ followerId: ira.id }, { followeeId: ira.id }] }, select: { followerId: true, followeeId: true, createdAt: true } });
    const followerSet = new Set(existingFollows.filter((f) => f.followeeId === ira.id).map((f) => f.followerId));
    const followingSet = new Set(existingFollows.filter((f) => f.followerId === ira.id).map((f) => f.followeeId));
    const followAt = new Map<string, Date>(existingFollows.filter((f) => f.followeeId === ira.id).map((f) => [f.followerId, f.createdAt]));
    for (const d of dots) {
      if (followerSet.has(d.id)) continue;
      const at = after([d.createdAt], Math.max(d.createdAt, now - 70 * DAY), now - 2 * HOUR);
      followAt.set(d.id, at);
      followRows.push({ followerId: d.id, followeeId: ira.id, status: "accepted", createdAt: at });
      notifs.push({ recipientId: ira.id, actorId: d.id, type: "new_follower", subjectType: "user", subjectId: d.id, createdAt: at, readAt: markRead(at) });
    }
    const followsBack = [...dots].filter((d) => !followingSet.has(d.id)).sort((a, b) => b.pop * (0.5 + rand()) - a.pop * (0.5 + rand())).slice(0, Math.max(0, 45 - followingSet.size));
    for (const d of followsBack) {
      const at = after([d.createdAt], Math.max(d.createdAt, followAt.get(d.id)?.getTime() ?? 0), now - HOUR);
      followRows.push({ followerId: ira.id, followeeId: d.id, status: "accepted", createdAt: at });
      notifs.push({ recipientId: d.id, actorId: ira.id, type: "new_follower", subjectType: "user", subjectId: ira.id, createdAt: at, readAt: markRead(at) });
    }
    for (const part of chunk(followRows, 500)) await prisma.follow.createMany({ data: part });
    for (const d of followsBack) await prisma.profile.update({ where: { userId: d.id }, data: { followerCount: { increment: 1 } } });
    for (const d of dots.filter((x) => !followerSet.has(x.id))) await prisma.profile.update({ where: { userId: d.id }, data: { followingCount: { increment: 1 } } });
    await prisma.profile.update({ where: { userId: ira.id }, data: { followerCount: await prisma.follow.count({ where: { followeeId: ira.id, status: "accepted" } }), followingCount: await prisma.follow.count({ where: { followerId: ira.id, status: "accepted" } }) } });

    // ================= Skill endorsements =================
    const endorse: { skillId: string; endorserId: string; createdAt: Date }[] = [];
    for (const s of ira.skills) {
      const endorsers = shuffle(dots).slice(0, between(14, 70));
      endorsers.forEach((d) => endorse.push({ skillId: s.id, endorserId: d.id, createdAt: after([d.createdAt], Math.max(d.createdAt, now - 60 * DAY), now - HOUR) }));
      await prisma.skill.update({ where: { id: s.id }, data: { endorsementCount: endorsers.length } });
      for (const d of endorsers.slice(0, 3)) notifs.push({ recipientId: ira.id, actorId: d.id, type: "like", subjectType: "skill", subjectId: s.id, createdAt: after([d.createdAt], now - 40 * DAY, now - HOUR), readAt: null });
    }
    for (const part of chunk(endorse, 800)) await prisma.skillEndorsement.createMany({ data: part });

    // ================= Posts =================
    type PostRow = { id: string; authorId: string; body: string; createdAt: Date; likeCount: number; replyCount: number; repostCount: number; trendingScore: number; replyToId: string | null; repostOfId: string | null; postType: string; acceptedAnswerId: string | null };
    const posts: PostRow[] = [];
    const likes: { postId: string; userId: string; createdAt: Date }[] = [];
    const bookmarks: { postId: string; userId: string; createdAt: Date }[] = [];
    const media: { postId: string; type: string; url: string; position: number }[] = [];
    const polls: { id: string; postId: string; closesAt: Date; options: { id: string; label: string; position: number }[] }[] = [];
    const votes: { pollOptionId: string; userId: string; createdAt: Date }[] = [];
    const mk = (o: Partial<PostRow> & { id: string; authorId: string; body: string; createdAt: Date }): PostRow => ({ likeCount: 0, replyCount: 0, repostCount: 0, trendingScore: 0, replyToId: null, repostOfId: null, postType: "standard", acceptedAnswerId: null, ...o });
    const dotsWithFit = (re: RegExp) => dots.filter((d) => re.test(d.bio));
    const mention = (re: RegExp, n = 2) => shuffle(dotsWithFit(re)).slice(0, n);
    const ownStart = now - 118 * DAY;
    const spread = (i: number, n: number) => new Date(ownStart + ((i + rand() * 0.8) / n) * (now - ownStart - 3 * HOUR));

    // Scale art for photo posts.
    for (const s of SCALES) for (let n = 0; n < 2; n++) writeFileSync(`public/uploads/showcase-scale-${s.key}-${n}.svg`, dotSquareSvg(s.name, SCALES.indexOf(s) + 2, s.color, 640, s.matters));

    // 1) Standalone posts (with mentions on a few, photos on the first eleven).
    const standalone: PostRow[] = [];
    POSTS.forEach((body, i) => {
      let text = body;
      if (i % 4 === 1) {
        const tags = mention(i % 8 === 1 ? /Teacher|Educator|Professor/ : /Engineer|Data|Design/, 2);
        text += ` cc ${tags.map((t) => `@${t.handle}`).join(" ")}`;
      }
      const p = mk({ id: randomUUID(), authorId: ira.id, body: text.slice(0, 500), createdAt: spread(i, POSTS.length) });
      standalone.push(p);
      if (i < 11) {
        const count = i % 3 === 0 ? 3 : i % 3 === 1 ? 1 : 2;
        for (let m = 0; m < count; m++) media.push({ postId: p.id, type: "image", url: `/uploads/showcase-scale-${SCALES[(i + m) % 7].key}-${m % 2}.svg`, position: m });
      }
    });
    posts.push(...standalone);

    // 2) The scale thread (self-replies, one per scale plus a closing post).
    const threadStart = now - 21 * DAY;
    const threadIntro = mk({ id: randomUUID(), authorId: ira.id, body: THREAD_INTRO, createdAt: new Date(threadStart) });
    posts.push(threadIntro);
    let prev = threadIntro;
    THREAD_POSTS.forEach((body, i) => {
      const p = mk({ id: randomUUID(), authorId: ira.id, body, createdAt: new Date(threadStart + (i + 1) * 4 * MIN), replyToId: prev.id });
      prev.replyCount++;
      posts.push(p);
      if (i < 7) media.push({ postId: p.id, type: "image", url: `/uploads/showcase-scale-${SCALES[i].key}-0.svg`, position: 0 });
      prev = p;
    });

    // 3) Polls with votes.
    POLLS.forEach((poll, i) => {
      const past = i % 2 === 0;
      const at = spread(i * 6 + 3, 30);
      const p = mk({ id: randomUUID(), authorId: ira.id, body: poll.body, createdAt: at });
      posts.push(p);
      const closesAt = past ? new Date(at.getTime() + 5 * DAY) : new Date(now + between(2, 6) * DAY);
      const options = poll.options.map((label, position) => ({ id: randomUUID(), label, position }));
      polls.push({ id: randomUUID(), postId: p.id, closesAt: closesAt.getTime() > now && past ? new Date(now - DAY) : closesAt, options });
      const weights = options.map(() => 0.3 + rand());
      const total = weights.reduce((s, w) => s + w, 0);
      for (const d of shuffle(dots).slice(0, between(35, 80))) {
        let r = rand() * total;
        let idx = 0;
        while (idx < weights.length - 1 && r > weights[idx]) r -= weights[idx++];
        votes.push({ pollOptionId: options[idx].id, userId: d.id, createdAt: after([d.createdAt], Math.max(at.getTime(), d.createdAt), Math.min(closesAt.getTime(), now)) });
      }
    });

    // 4) Questions with community answers (two get an accepted answer).
    QUESTIONS.forEach((q, i) => {
      const at = spread(i * 9 + 5, 40);
      const question = mk({ id: randomUUID(), authorId: ira.id, body: q.body, createdAt: at, postType: "question" });
      posts.push(question);
      const answerers = shuffle(dots).slice(0, q.answers.length);
      q.answers.forEach((text, j) => {
        const ans = mk({ id: randomUUID(), authorId: answerers[j].id, body: text, createdAt: after([answerers[j].createdAt], Math.max(at.getTime(), answerers[j].createdAt), now - HOUR), replyToId: question.id });
        posts.push(ans);
        question.replyCount++;
        if (j === 0 && i < 2) question.acceptedAnswerId = ans.id;
        notifs.push({ recipientId: ira.id, actorId: answerers[j].id, type: "comment", subjectType: "post", subjectId: question.id, createdAt: ans.createdAt, readAt: markRead(ans.createdAt) });
        if (j === 0) {
          const back = mk({ id: randomUUID(), authorId: ira.id, body: "Thank you, this is exactly the kind of practical answer I hoped for 🙏", createdAt: after([], ans.createdAt.getTime(), now), replyToId: ans.id });
          posts.push(back);
          ans.replyCount++;
          notifs.push({ recipientId: answerers[j].id, actorId: ira.id, type: "comment", subjectType: "post", subjectId: ans.id, createdAt: back.createdAt, readAt: markRead(back.createdAt) });
        }
      });
    });

    // 5) Engagement on everything Ira wrote (except the question answers).
    const owned = posts.filter((p) => p.authorId === ira.id && !p.replyToId || (p.authorId === ira.id && THREAD_POSTS.includes(p.body)));
    for (const p of owned) {
      const isThread = p !== threadIntro && THREAD_POSTS.includes(p.body);
      const factor = p === threadIntro ? 1.6 : isThread ? 0.6 : 1;
      const likers = shuffle(dots).slice(0, Math.min(dots.length, Math.floor((12 + rand() * 80) * factor)));
      likers.forEach((d, k) => {
        const at = after([d.createdAt], Math.max(p.createdAt.getTime(), d.createdAt), p.createdAt.getTime() + 6 * DAY);
        likes.push({ postId: p.id, userId: d.id, createdAt: at });
        if (k < 6) notifs.push({ recipientId: ira.id, actorId: d.id, type: "like", subjectType: "post", subjectId: p.id, createdAt: at, readAt: markRead(at) });
      });
      p.likeCount = likers.length;
      const replyN = p.postType === "question" ? 0 : between(1, isThread ? 3 : 7);
      for (const d of shuffle(dots).slice(0, replyN)) {
        const at = after([d.createdAt], Math.max(p.createdAt.getTime(), d.createdAt), p.createdAt.getTime() + 4 * DAY);
        const replyId = randomUUID();
        posts.push(mk({ id: replyId, authorId: d.id, body: chance(0.75) ? pick(REPLIES_TO_IRA) : pick(REPLIES), createdAt: at, replyToId: p.id }));
        p.replyCount++;
        notifs.push({ recipientId: ira.id, actorId: d.id, type: "comment", subjectType: "post", subjectId: p.id, createdAt: at, readAt: markRead(at) });
        if (chance(0.4)) {
          const backAt = after([], at.getTime(), at.getTime() + DAY);
          posts.push(mk({ id: randomUUID(), authorId: ira.id, body: pick(IRA_REPLY_BACKS), createdAt: backAt, replyToId: replyId }));
          posts.find((x) => x.id === replyId)!.replyCount++;
          notifs.push({ recipientId: d.id, actorId: ira.id, type: "comment", subjectType: "post", subjectId: replyId, createdAt: backAt, readAt: markRead(backAt) });
        }
      }
      if (chance(0.5)) {
        for (const d of shuffle(dots).slice(0, between(1, 6))) {
          const quote = chance(0.25);
          posts.push(mk({ id: randomUUID(), authorId: d.id, body: quote ? pick(REPLIES_TO_IRA) : "", createdAt: after([d.createdAt], Math.max(p.createdAt.getTime(), d.createdAt), p.createdAt.getTime() + 5 * DAY), repostOfId: p.id }));
          p.repostCount++;
        }
      }
      if (chance(0.5)) for (const d of shuffle(dots).slice(0, between(1, 8))) bookmarks.push({ postId: p.id, userId: d.id, createdAt: after([d.createdAt], Math.max(p.createdAt.getTime(), d.createdAt), now) });
      const ageD = Math.max(0, (now - p.createdAt.getTime()) / DAY);
      p.trendingScore = (p.likeCount + 2 * p.replyCount + 3 * p.repostCount) / Math.pow(1 + ageD, 1.2);
    }

    // Mention notifications for Ira's cc lines (recipients are parsed from the body).
    const byHandle = new Map(dots.map((d) => [d.handle, d]));
    for (const p of standalone) for (const m of p.body.matchAll(/@([a-z0-9_]+)/g)) {
      const d = byHandle.get(m[1]);
      if (d) notifs.push({ recipientId: d.id, actorId: ira.id, type: "mention", subjectType: "post", subjectId: p.id, createdAt: p.createdAt, readAt: markRead(p.createdAt) });
    }

    // ---- write (parents before dependents) ----
    const depth = (p: PostRow): number => (p.replyToId ? 1 + depth(posts.find((q) => q.id === p.replyToId)!) : 0);
    const rank = (p: PostRow) => (p.repostOfId ? 100 : depth(p)); // reposts last: they may point at replies/thread posts
    // A question and its accepted answer reference each other; insert the question first and link afterwards.
    const accepted = posts.filter((p) => p.acceptedAnswerId).map((p) => ({ id: p.id, answer: p.acceptedAnswerId! }));
    for (const p of posts) p.acceptedAnswerId = null;
    const ordered = [...posts].sort((a, b) => rank(a) - rank(b));
    for (const part of chunk(ordered, 400)) await prisma.post.createMany({ data: part });
    for (const a of accepted) await prisma.post.update({ where: { id: a.id }, data: { acceptedAnswerId: a.answer } });
    for (const part of chunk(media.map((m) => ({ ...m, id: randomUUID() })), 500)) await prisma.postMedia.createMany({ data: part });
    for (const pl of polls) {
      await prisma.poll.create({ data: { id: pl.id, postId: pl.postId, closesAt: pl.closesAt, options: { create: pl.options } } });
    }
    for (const part of chunk(votes, 800)) await prisma.pollVote.createMany({ data: part });
    for (const part of chunk(likes, 800)) await prisma.postLike.createMany({ data: part });
    for (const part of chunk(bookmarks, 800)) await prisma.bookmark.createMany({ data: part });

    // ================= Direct messages =================
    let dmThreads = 0;
    if (canEncrypt) {
      const talked = new Set((await prisma.conversationParticipant.findMany({ where: { conversation: { participants: { some: { userId: ira.id } } }, userId: { not: ira.id } }, select: { userId: true } })).map((c) => c.userId));
      const senders = shuffle(dots.filter((d) => !talked.has(d.id))).slice(0, DM_LINES.length);
      for (const [i, d] of senders.entries()) {
        const lines = DM_LINES[i];
        let t = after([d.createdAt], Math.max(d.createdAt, followAt.get(d.id)!.getTime()), now - 2 * DAY).getTime();
        const msgs = lines.map((line, k) => {
          t += between(2, 240) * MIN;
          return { id: randomUUID(), senderId: k % 2 === 0 ? d.id : ira.id, body: line.replaceAll("{a}", d.first).replaceAll("{city}", d.city), createdAt: new Date(Math.min(t, now - MIN)) };
        });
        const last = msgs[msgs.length - 1];
        const conv = await prisma.conversation.create({
          data: {
            kind: "direct", createdBy: d.id, createdAt: msgs[0].createdAt, directKey: [d.id, ira.id].sort().join(":"), lastMessageAt: last.createdAt, lastMessageSenderId: last.senderId,
            lastMessagePreview: encryptAtRest(last.body.length > 80 ? `${last.body.slice(0, 77)}...` : last.body),
            participants: { create: [{ userId: d.id, joinedAt: msgs[0].createdAt }, { userId: ira.id, joinedAt: msgs[0].createdAt }] },
            requestState: { create: { status: followingSet.has(d.id) || followsBack.some((f) => f.id === d.id) ? "accepted" : "pending", initiatedBy: d.id } },
          },
        });
        await prisma.message.createMany({ data: msgs.map((m) => ({ id: m.id, conversationId: conv.id, senderId: m.senderId, body: encryptAtRest(m.body), createdAt: m.createdAt })) });
        await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conv.id, userId: last.senderId } }, data: { lastReadMessageId: last.id } });
        dmThreads++;
      }
    } else console.log("Skipping DMs: MESSAGE_ENCRYPTION_KEY missing/invalid.");

    for (const part of chunk(notifs, 800)) await prisma.notification.createMany({ data: part });

    const iraPostCount = posts.filter((p) => p.authorId === ira.id && !p.replyToId).length;
    console.log(
      `Done: @${SHOWCASE_HANDLE} profile upgraded. +${followRows.filter((f) => f.followeeId === ira.id).length} followers, +${followsBack.length} follow-backs. ` +
        `${iraPostCount + THREAD_POSTS.length} own posts (${polls.length} polls, ${QUESTIONS.length} questions, thread of ${THREAD_POSTS.length + 1}), ${posts.length} posts incl. replies/reposts, ${likes.length} likes, ${votes.length} poll votes, ` +
        `${endorse.length} endorsements, ${linkIds.length} links, ${dmThreads} DM threads, ${notifs.length} notifications.`,
    );
    console.log("Next: seed-showcase-content.ts, seed-showcase-org.ts, seed-showcase-monetization.ts (no undo; restore a DB backup to redo).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
