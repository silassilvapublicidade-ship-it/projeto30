import { TodayExperience } from "@/components/member/today-experience";
import { getMemberContext } from "@/server/services/member-area.service";

export default async function HojePage() {
  const context = await getMemberContext();

  return <TodayExperience context={context} />;
}
