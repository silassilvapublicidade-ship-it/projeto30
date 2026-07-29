import { Skeleton } from "@/components/ui/feedback";

export default function AdminChallengesLoading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
