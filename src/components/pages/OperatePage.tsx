import { WriteCard } from "@/components/WriteCard";

interface OperatePageProps {
  onStatsRefresh?: () => void;
}

export function OperatePage({ onStatsRefresh }: OperatePageProps) {
  return <WriteCard onStatsRefresh={onStatsRefresh} />;
}
