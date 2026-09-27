import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { NewCampaignForm } from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  return (
    <div className="profileCard">
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>Start a fundraiser</h1>
      <NewCampaignForm />
    </div>
  );
}
