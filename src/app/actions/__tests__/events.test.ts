import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import {
  createEvent,
  publishEvent,
  cancelEvent,
  rsvpToEvent,
  createTicketType,
  purchaseTicket,
  checkInTicket,
} from "@/app/actions/events";
import { createUser, createSessionForUser, createCommunity, addCommunityMember } from "@/test/factories";
import { setSessionCookie, cookieJar, NextRedirectSignal, redirectState } from "@/test/next-test-state";

async function loginAs(userId: string) {
  cookieJar.clear();
  setSessionCookie(await createSessionForUser(userId));
}

function fd(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

let slugCounter = 0;
function uniqueSlug() {
  slugCounter += 1;
  return `ev_${Date.now().toString(36)}_${slugCounter}`;
}

async function makeEvent(
  hostId: string,
  overrides: Partial<{ status: string; capacity: number | null; hostedByCommunityId: string; hostedByUserId: string | null }> = {},
) {
  return db.event.create({
    data: {
      slug: uniqueSlug(),
      title: "Test meetup",
      format: "virtual",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      timezone: "Asia/Kolkata",
      status: overrides.status ?? "published",
      capacity: overrides.capacity ?? null,
      createdBy: hostId,
      hostedByUserId: overrides.hostedByCommunityId ? null : (overrides.hostedByUserId ?? hostId),
      hostedByCommunityId: overrides.hostedByCommunityId ?? null,
    },
  });
}

async function makeTicketType(eventId: string, overrides: Partial<{ quantityTotal: number; salesEndAt: Date }> = {}) {
  return db.ticketType.create({
    data: { eventId, name: "General", quantityTotal: overrides.quantityTotal ?? null, salesEndAt: overrides.salesEndAt ?? null },
  });
}

async function makeTicket(ticketTypeId: string, ownerId: string, status = "valid") {
  return db.ticket.create({
    data: { ticketTypeId, ownerId, status, qrCodeToken: `qr_${ownerId}_${Math.random().toString(36).slice(2)}` },
  });
}

function eventFormFields(overrides: Record<string, string> = {}) {
  return {
    title: "Kochi builders meetup",
    slug: uniqueSlug(),
    format: "in_person",
    location: "Fort Kochi",
    timezone: "Asia/Kolkata",
    startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("createEvent", () => {
  it("creates a self-hosted event as a draft and redirects to it", async () => {
    const host = await createUser();
    await loginAs(host.id);
    const fields = eventFormFields();

    await expect(createEvent(undefined, fd(fields))).rejects.toBeInstanceOf(NextRedirectSignal);
    expect(redirectState.url).toBe(`/e/${fields.slug}`);

    const event = await db.event.findUniqueOrThrow({ where: { slug: fields.slug } });
    expect(event.status).toBe("draft");
    expect(event.hostedByUserId).toBe(host.id);
    expect(event.hostedByBusinessId).toBeNull();
    expect(event.hostedByCommunityId).toBeNull();
  });

  it("requires a location for in-person events", async () => {
    await loginAs((await createUser()).id);
    const result = await createEvent(undefined, fd(eventFormFields({ location: "" })));
    expect(result?.error).toMatch(/location is required/i);
  });

  it("won't let a non-moderator host an event for a community", async () => {
    const community = await createCommunity();
    const outsider = await createUser();
    await loginAs(outsider.id);
    const result = await createEvent(undefined, fd(eventFormFields({ hostType: "community", hostId: community.id })));
    expect(result?.error).toBe("You don't moderate that community.");
  });

  it("rejects an end time before the start time", async () => {
    await loginAs((await createUser()).id);
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const result = await createEvent(
      undefined,
      fd(eventFormFields({ startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() - 60_000).toISOString() })),
    );
    expect(result?.error).toMatch(/can't be before/i);
  });
});

describe("publishEvent", () => {
  it("publishes a draft for the host, and is a no-op for anyone else", async () => {
    const host = await createUser();
    const stranger = await createUser();
    const event = await makeEvent(host.id, { status: "draft" });

    await loginAs(stranger.id);
    await publishEvent(fd({ eventId: event.id }));
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("draft");

    await loginAs(host.id);
    await publishEvent(fd({ eventId: event.id }));
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("published");
  });
});

// Phase 8 spec §4.3: capacity is a hard cap on "going" (RSVPs + live tickets
// combined); "interested" never counts against it.
describe("rsvpToEvent", () => {
  it("won't accept RSVPs on a draft event", async () => {
    const event = await makeEvent((await createUser()).id, { status: "draft" });
    await loginAs((await createUser()).id);
    const result = await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }));
    expect(result?.error).toMatch(/isn't accepting RSVPs/);
  });

  it("caps 'going' at capacity, counting tickets too, but always allows 'interested'", async () => {
    const host = await createUser();
    const event = await makeEvent(host.id, { capacity: 2 });
    const ticketType = await makeTicketType(event.id);

    const first = await createUser();
    await loginAs(first.id);
    expect(await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }))).toBeUndefined();

    // A ticket holder takes the second seat.
    await makeTicket(ticketType.id, (await createUser()).id);

    const late = await createUser();
    await loginAs(late.id);
    const rejected = await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }));
    expect(rejected?.error).toBe("This event is at capacity.");
    expect(await rsvpToEvent(undefined, fd({ eventId: event.id, status: "interested" }))).toBeUndefined();

    // Someone already going can re-submit "going" while the event is full.
    await loginAs(first.id);
    expect(await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }))).toBeUndefined();
    expect(await db.eventRSVP.count({ where: { eventId: event.id, status: "going" } })).toBe(1);
  });

  it("frees a seat when someone switches from going to not_going", async () => {
    const event = await makeEvent((await createUser()).id, { capacity: 1 });
    const first = await createUser();
    await loginAs(first.id);
    await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }));
    await rsvpToEvent(undefined, fd({ eventId: event.id, status: "not_going" }));

    await loginAs((await createUser()).id);
    expect(await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" }))).toBeUndefined();
  });
});

describe("createTicketType", () => {
  it("refuses a paid tier on a community-hosted event but allows a free one", async () => {
    const moderator = await createUser();
    const community = await createCommunity({ creatorId: moderator.id });
    await addCommunityMember(community.id, moderator.id, { role: "moderator" });
    const event = await makeEvent(moderator.id, { hostedByCommunityId: community.id });
    await loginAs(moderator.id);

    const paid = await createTicketType(undefined, fd({ eventId: event.id, name: "VIP", price: "10" }));
    expect(paid?.error).toMatch(/Community-hosted events can't sell paid tickets/);

    expect(await createTicketType(undefined, fd({ eventId: event.id, name: "Free entry" }))).toBeUndefined();
    const types = await db.ticketType.findMany({ where: { eventId: event.id } });
    expect(types.map((t) => [t.name, t.price])).toEqual([["Free entry", null]]);
  });

  it("only lets the host add ticket types", async () => {
    const event = await makeEvent((await createUser()).id);
    await loginAs((await createUser()).id);
    const result = await createTicketType(undefined, fd({ eventId: event.id, name: "General" }));
    expect(result?.error).toBe("Only the host can add ticket types.");
  });
});

describe("purchaseTicket (free tier)", () => {
  it("issues a ticket with an unguessable QR token, bumps the sold count, and sends a receipt notification", async () => {
    const event = await makeEvent((await createUser()).id);
    const ticketType = await makeTicketType(event.id, { quantityTotal: 5 });
    const buyer = await createUser();
    await loginAs(buyer.id);

    expect(await purchaseTicket(undefined, fd({ ticketTypeId: ticketType.id }))).toBeUndefined();

    const ticket = await db.ticket.findFirstOrThrow({ where: { ticketTypeId: ticketType.id, ownerId: buyer.id } });
    expect(ticket.status).toBe("valid");
    expect(ticket.qrCodeToken).toMatch(/^[0-9a-f]{48}$/);
    expect(ticket.qrCodeToken).not.toContain(buyer.id);
    expect((await db.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } })).quantitySold).toBe(1);
    expect(await db.notification.count({ where: { recipientId: buyer.id, type: "ticket_purchased", subjectId: event.slug } })).toBe(1);
  });

  it("rejects a sold-out tier and a tier whose sales window has closed", async () => {
    const event = await makeEvent((await createUser()).id);
    const soldOut = await makeTicketType(event.id, { quantityTotal: 1 });
    await db.ticketType.update({ where: { id: soldOut.id }, data: { quantitySold: 1 } });
    const closed = await makeTicketType(event.id, { salesEndAt: new Date(Date.now() - 60_000) });
    await loginAs((await createUser()).id);

    expect((await purchaseTicket(undefined, fd({ ticketTypeId: soldOut.id })))?.error).toBe("This ticket type is sold out.");
    expect((await purchaseTicket(undefined, fd({ ticketTypeId: closed.id })))?.error).toBe("Ticket sales have closed.");
  });

  it("rejects a purchase once the event is at capacity", async () => {
    const event = await makeEvent((await createUser()).id, { capacity: 1 });
    const ticketType = await makeTicketType(event.id);
    await makeTicket(ticketType.id, (await createUser()).id);
    await loginAs((await createUser()).id);
    expect((await purchaseTicket(undefined, fd({ ticketTypeId: ticketType.id })))?.error).toBe("This event is at capacity.");
  });
});

describe("checkInTicket", () => {
  it("checks a ticket in once, for the host only", async () => {
    const host = await createUser();
    const event = await makeEvent(host.id);
    const ticketType = await makeTicketType(event.id);
    const ticket = await makeTicket(ticketType.id, (await createUser()).id);

    await loginAs((await createUser()).id);
    expect((await checkInTicket(undefined, fd({ qrCodeToken: ticket.qrCodeToken })))?.error).toBe("Only the host can check in attendees.");

    await loginAs(host.id);
    expect(await checkInTicket(undefined, fd({ qrCodeToken: ticket.qrCodeToken }))).toBeUndefined();
    const checkedIn = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.checkedInAt).not.toBeNull();

    expect((await checkInTicket(undefined, fd({ qrCodeToken: ticket.qrCodeToken })))?.error).toBe("Already checked in.");
  });

  it("refuses cancelled and unknown tickets", async () => {
    const host = await createUser();
    const event = await makeEvent(host.id);
    const ticketType = await makeTicketType(event.id);
    const cancelled = await makeTicket(ticketType.id, (await createUser()).id, "cancelled");
    await loginAs(host.id);

    expect((await checkInTicket(undefined, fd({ qrCodeToken: cancelled.qrCodeToken })))?.error).toBe("This ticket was cancelled.");
    expect((await checkInTicket(undefined, fd({ qrCodeToken: "no-such-token" })))?.error).toBe("Ticket not found.");
  });
});

// Phase 8 spec §8.4: event_cancelled goes to every current RSVP (going or
// interested) and every live ticket holder — not ticket holders only.
describe("cancelEvent", () => {
  it("notifies going/interested RSVPs and ticket holders exactly once each", async () => {
    const host = await createUser();
    const event = await makeEvent(host.id);
    const ticketType = await makeTicketType(event.id);
    const [going, interested, notGoing, ticketHolder, both, cancelledTicket] = await Promise.all(
      Array.from({ length: 6 }, () => createUser()),
    );
    await db.eventRSVP.createMany({
      data: [
        { eventId: event.id, userId: going.id, status: "going" },
        { eventId: event.id, userId: interested.id, status: "interested" },
        { eventId: event.id, userId: notGoing.id, status: "not_going" },
        { eventId: event.id, userId: both.id, status: "going" },
      ],
    });
    await makeTicket(ticketType.id, ticketHolder.id);
    await makeTicket(ticketType.id, both.id);
    await makeTicket(ticketType.id, cancelledTicket.id, "cancelled");

    await loginAs(host.id);
    await cancelEvent(fd({ eventId: event.id }));

    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("cancelled");
    const notified = await db.notification.findMany({ where: { type: "event_cancelled", subjectId: event.slug }, select: { recipientId: true } });
    expect(notified.map((n) => n.recipientId).sort()).toEqual([going.id, interested.id, ticketHolder.id, both.id].sort());
    expect(notified.some((n) => n.recipientId === notGoing.id || n.recipientId === cancelledTicket.id)).toBe(false);
  });

  it("can't be cancelled by someone who isn't the host", async () => {
    const event = await makeEvent((await createUser()).id);
    await loginAs((await createUser()).id);
    await cancelEvent(fd({ eventId: event.id }));
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("published");
  });

  it("stops accepting RSVPs and ticket purchases once cancelled", async () => {
    const host = await createUser();
    const event = await makeEvent(host.id);
    const ticketType = await makeTicketType(event.id);
    await loginAs(host.id);
    await cancelEvent(fd({ eventId: event.id }));

    await loginAs((await createUser()).id);
    expect((await rsvpToEvent(undefined, fd({ eventId: event.id, status: "going" })))?.error).toMatch(/isn't accepting RSVPs/);
    expect((await purchaseTicket(undefined, fd({ ticketTypeId: ticketType.id })))?.error).toMatch(/isn't accepting ticket purchases/);
  });
});
