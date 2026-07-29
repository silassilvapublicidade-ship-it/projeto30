import { Skeleton } from "@/components/ui/feedback";

export default function AdminLoading() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton className="h-24" key={index} />
        ))}
      </div>
    </div>
  );
}
