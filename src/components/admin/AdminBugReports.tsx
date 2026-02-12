import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bug, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BugReportDetail } from "./BugReportDetail";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface BugReport {
  id: string;
  user_email: string;
  title: string;
  description: string;
  status: string;
  page_url: string | null;
  user_agent: string | null;
  screen_size: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  nowy: "Nowy",
  w_trakcie: "W trakcie",
  potrzebne_informacje: "Potrzebne info",
  rozwiazany: "Rozwiązany",
  anulowane: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  nowy: "bg-blue-100 text-blue-800",
  w_trakcie: "bg-yellow-100 text-yellow-800",
  potrzebne_informacje: "bg-orange-100 text-orange-800",
  rozwiazany: "bg-green-100 text-green-800",
  anulowane: "bg-gray-100 text-gray-800",
};

export const AdminBugReports = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    let query = (supabase as any).from("bug_reports").select("*").order("created_at", { ascending: false });
    
    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching bug reports:", error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const newCount = reports.filter(r => r.status === "nowy").length;

  if (selectedReport) {
    return (
      <BugReportDetail
        report={selectedReport}
        onBack={() => {
          setSelectedReport(null);
          fetchReports();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle>Zgłoszenia błędów</CardTitle>
              <CardDescription>Lista zgłoszeń od użytkowników</CardDescription>
            </div>
            {newCount > 0 && (
              <Badge variant="destructive">{newCount} nowych</Badge>
            )}
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtruj status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Brak zgłoszeń</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Temat</TableHead>
                <TableHead>Użytkownik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedReport(report)}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(report.created_at), "dd MMM yyyy HH:mm", { locale: pl })}
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">{report.title}</TableCell>
                  <TableCell className="text-sm">{report.user_email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[report.status] || ""}`}>
                      {STATUS_LABELS[report.status] || report.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
