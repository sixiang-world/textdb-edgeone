import { FolderUpload } from "@/components/FolderUpload";

interface FolderPageProps {
  onStatsRefresh?: () => void;
}

export function FolderPage({ onStatsRefresh }: FolderPageProps) {
  return <FolderUpload onStatsRefresh={onStatsRefresh} />;
}
