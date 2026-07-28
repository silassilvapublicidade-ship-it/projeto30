import { Skeleton } from "@/components/ui/feedback";

export default function WorkspaceLoading() {
  return (
    <div className="space-y-10">
      <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-5 sm:p-8">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="mt-10 h-24 max-w-2xl rounded-[1.25rem]" />
        <Skeleton className="mt-8 h-44 max-w-sm rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-[1.35rem]" />
        <Skeleton className="h-20 rounded-[1.35rem]" />
        <Skeleton className="h-20 rounded-[1.35rem]" />
      </div>
    </div>
  );
}
