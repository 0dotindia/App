"use server";

import { revalidatePath } from "next/cache";
import { requireVerifiedUser } from "@/lib/auth-guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { fileDmcaTakedownNotice, fileDmcaCounterNotice } from "@/lib/dmca";
import type { ActionState } from "@/app/actions/auth";

// phase-13 spec §4.1/§4.4: a DMCA takedown notice must be acceptable from
// any real-world rights holder, most of whom have no 0dot account — unlike
// every other write action in this codebase, this one is deliberately
// unauthenticated. The statutory attestation/contact fields are what
// establish who's filing, not platform login.
export async function fileDmcaTakedownNoticeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  // Same shape as business-contact.ts's sendContactMessage — the only other
  // anonymous write action in this codebase — since dropping the auth gate
  // above otherwise leaves this endpoint with zero throttling, unlike every
  // other anonymous submission surface.
  if (!checkRateLimit(`dmca-notice:ip:${await getClientIp()}`, { max: 5, windowMs: 60 * 60 * 1000 })) {
    return { error: "Too many notices submitted. Please try again later." };
  }

  const result = await fileDmcaTakedownNotice({
    complainantName: String(formData.get("complainantName") ?? ""),
    complainantContact: String(formData.get("complainantContact") ?? ""),
    copyrightedWorkDescription: String(formData.get("copyrightedWorkDescription") ?? ""),
    infringingContentSubjectType: String(formData.get("infringingContentSubjectType") ?? ""),
    infringingContentLocation: String(formData.get("infringingContentLocation") ?? ""),
    goodFaithStatementAccepted: formData.get("goodFaithStatementAccepted") === "on",
    accuracyPerjuryStatementAccepted: formData.get("accuracyPerjuryStatementAccepted") === "on",
    signature: String(formData.get("signature") ?? ""),
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/trust-safety");
  return undefined;
}

// phase-13 spec §4.2/§4.5: filed by the alleged infringer against a notice
// that already removed their content — fileDmcaCounterNotice itself
// enforces that the filer actually owns that content.
export async function fileDmcaCounterNoticeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();

  const result = await fileDmcaCounterNotice({
    originalNoticeId: String(formData.get("originalNoticeId") ?? ""),
    subjectUserId: user.id,
    goodFaithStatementAccepted: formData.get("goodFaithStatementAccepted") === "on",
    consentToJurisdiction: formData.get("consentToJurisdiction") === "on",
    signature: String(formData.get("signature") ?? ""),
  });
  if (result.error) return { error: result.error };

  revalidatePath("/dmca");
  return undefined;
}
