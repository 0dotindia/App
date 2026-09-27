import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { archiveTier, cancelSubscription } from "@/app/actions/memberships";
import { SettingsRow } from "@/components/SettingsRow";
import { EmptyState } from "@/components/EmptyState";
import { TierForm } from "../../TierForm";
import { COIN_FUNDED_MARKER, describeRenewal, RENEWAL_PREFIX } from "@/lib/subscription-access";
import { formatCoins } from "@/lib/coins";

export const metadata: Metadata = { title: "Memberships" };

// The row's status plus, while it still grants access, what happens at the
// next period boundary (renews / ends / grace after a failed coin renewal).
function membershipStatusText(sub: {
  status: string;
  autoRenew: boolean;
  processorSubscriptionId: string;
  currentPeriodEnd: Date;
  tier: { name: string };
}): string {
  const renewal = describeRenewal(sub);
  if (sub.status !== "active" && renewal.date <= new Date()) return `${sub.tier.name} (${sub.status})`;
  const next = RENEWAL_PREFIX[renewal.kind].trim().toLowerCase();
  return `${sub.tier.name} (${sub.status}, ${next} ${renewal.date.toLocaleDateString()})`;
}

export default async function MembershipsSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // spec §4: the creator's own tiers (every status — archived tiers still
  // need to show up here so they can be reactivated, unlike the public
  // profile which only ever offers active ones) and this user's own
  // subscriptions to *other* creators' tiers (the fan side of the same
  // feature, surfaced on the same settings page rather than a second
  // route).
  const [myTiers, mySubscriptions] = await Promise.all([
    db.membershipTier.findMany({ where: { creatorId: currentUser.id }, orderBy: { level: "asc" } }),
    db.membershipSubscription.findMany({
      where: { fanId: currentUser.id },
      orderBy: { createdAt: "desc" },
      include: { tier: { include: { creator: { include: { username: true, profile: true } } } } },
    }),
  ]);

  return (
    <div className="settingsSection">
      <h2 className="settingsSectionHeading">Memberships</h2>
      {myTiers.length === 0 && <EmptyState message="No membership tiers yet." />}
      {myTiers.map((tier) => (
        <div key={tier.id} className="settingsGroup" style={{ marginBottom: "var(--space-3)" }}>
          <SettingsRow
            icon={Layers}
            thumbnail={
              tier.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small settings-list thumbnail, not an optimizable static asset
                <img src={tier.coverImageUrl} alt="" />
              ) : undefined
            }
            label={tier.name}
            description={`Level ${tier.level} · ${formatCoins(tier.price)}/${tier.billingInterval === "yearly" ? "yr" : "mo"} · ${tier.status}`}
            trailing={
              tier.status === "active" ? (
                <form action={archiveTier}>
                  <input type="hidden" name="tierId" value={tier.id} />
                  <button type="submit" className="button buttonSecondary buttonSmall">Archive</button>
                </form>
              ) : undefined
            }
          />
          <details>
            <summary className="settingsRow settingsAddTrigger">
              <span className="settingsRowIcon" aria-hidden="true">
                <Pencil size={16} />
              </span>
              <span className="settingsRowText">
                <span className="settingsRowLabel">Edit</span>
              </span>
            </summary>
            <div className="settingsAddPanelBody">
              <TierForm tier={tier} />
            </div>
          </details>
        </div>
      ))}
      <details className="settingsGroup">
        <summary className="settingsRow settingsAddTrigger">
          <span className="settingsRowIcon" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="settingsRowText">
            <span className="settingsRowLabel">Add a tier</span>
          </span>
        </summary>
        <div className="settingsAddPanelBody">
          <TierForm />
        </div>
      </details>

      {mySubscriptions.length > 0 && (
        <>
          <p className="settingsGroupLabel">My subscriptions</p>
          <div className="settingsGroup">
            {mySubscriptions.map((sub) => (
              <SettingsRow
                key={sub.id}
                icon={Layers}
                label={
                  sub.tier.creator.username ? (
                    <Link href={`/${sub.tier.creator.username.handle}`}>{sub.tier.creator.profile?.displayName ?? sub.tier.creator.username.handle}</Link>
                  ) : (
                    "Unknown creator"
                  )
                }
                description={membershipStatusText(sub)}
                trailing={
                  sub.status === "active" || (sub.status === "past_due" && sub.processorSubscriptionId.startsWith(COIN_FUNDED_MARKER)) ? (
                    <form action={cancelSubscription}>
                      <input type="hidden" name="subscriptionId" value={sub.id} />
                      <button type="submit" className="button buttonSecondary buttonSmall">Cancel</button>
                    </form>
                  ) : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
