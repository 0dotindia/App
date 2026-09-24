import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const p = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.CHK_URL ?? "file:./prisma/dev.db" }) });
(async () => {
  console.log(`events=${await p.event.count()} rsvps=${await p.eventRSVP.count()} tickets=${await p.ticket.count()} ticketPT=${await p.paymentTransaction.count({ where: { kind: "ticket_purchase" } })} jobs=${await p.job.count()} apps=${await p.jobApplication.count()} alerts=${await p.jobAlert.count()} jobNotifs=${await p.notification.count({ where: { type: { in: ["job_alert_match", "job_application", "application_status"] } } })}`);
  if (process.env.CHK_URL) return;
  const evs = await p.event.findMany({ where: { status: "published" }, select: { slug: true, capacity: true, rsvps: { where: { status: "going" }, select: { id: true } }, ticketTypes: { select: { quantityTotal: true, quantitySold: true, tickets: { where: { status: { not: "cancelled" } }, select: { id: true } } } } } });
  const overCap = evs.filter((e) => e.capacity !== null && e.rsvps.length > e.capacity);
  const badSold = evs.flatMap((e) => e.ticketTypes).filter((t) => t.quantitySold !== t.tickets.length || (t.quantityTotal !== null && t.quantitySold > t.quantityTotal));
  console.log("over capacity:", overCap.length, "ticket sold mismatches:", badSold.length);
  const j = await p.job.findFirst({ where: { status: "open", business: { slug: "nirmaan_tech_labs" } }, select: { id: true } });
  const e = await p.event.findFirst({ where: { slug: "desi_devs_hack_night" }, select: { slug: true } });
  console.log(JSON.stringify({ job: `/b/nirmaan_tech_labs/jobs/${j?.id}`, ev: `/e/${e?.slug}` }));
})().finally(() => p.$disconnect());
