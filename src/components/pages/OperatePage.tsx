import { useState } from "react";
import { WriteCard } from "@/components/WriteCard";
import { KeyHistory } from "@/components/KeyHistory";

export function OperatePage() {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);

  return (
    <div className="flex flex-col gap-4">
      <WriteCard selectedKey={selectedKey} />
      <KeyHistory onSelect={(key) => setSelectedKey(key)} />
    </div>
  );
}
