import { redirectToMemberStart } from "@/server/services/member-area.service";

export default async function AppPage() {
  await redirectToMemberStart();
}
