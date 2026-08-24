"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ReportGeneratorProps {
  reportId: string;
  title: string;
  fetchData: () => Promise<unknown>;
  renderDocument: (data: unknown) => React.JSX.Element;
}

export function ReportGenerator({ reportId, title, fetchData, renderDocument }: ReportGeneratorProps) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await fetchData();
      const doc = renderDocument(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportId}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${title} downloaded successfully.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed to generate report: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={generate} disabled={loading} size="sm" variant="outline" className="w-full">
      {loading ? (
        <Loader2 className="size-4 animate-spin mr-1.5" />
      ) : (
        <Download className="size-4 mr-1.5" />
      )}
      {loading ? "Generating..." : "Download PDF"}
    </Button>
  );
}
