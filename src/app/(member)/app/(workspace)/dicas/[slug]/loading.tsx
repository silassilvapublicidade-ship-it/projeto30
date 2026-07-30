import { Skeleton } from "@/components/ui/feedback";

export default function DicaDetailLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="aspect-[4/5] w-full rounded-[1.5rem] sm:aspect-[16/9]" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
