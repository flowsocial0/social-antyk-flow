import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2, HardDrive, Database, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StorageFolder {
  name: string;
  fileCount: number;
}

interface MonitorData {
  success: boolean;
  storage: {
    folders: StorageFolder[];
    totalFiles: number;
    referencedPaths: number;
    orphanedFiles: number;
    orphanedFolders: string[];
    tempVideoFiles: number;
  };
  limits: {
    databaseMaxMB: number;
    storageMaxMB: number;
    egressMaxGB: number;
    edgeFunctionInvocationsMax: number;
  };
}

const getProgressColor = (percent: number) => {
  if (percent >= 80) return "bg-destructive";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-primary";
};

export const ResourceMonitor = () => {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-resource-monitor');
      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error('Error fetching resource data:', err);
      toast({ title: "Błąd", description: "Nie udało się pobrać danych o zasobach", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async (functionName: string, label: string) => {
    setCleanupLoading(functionName);
    try {
      const { data: result, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      toast({ title: "Sukces", description: result?.message || `${label} zakończone` });
      // Refresh data after cleanup
      await fetchData();
    } catch (err) {
      console.error(`Error running ${functionName}:`, err);
      toast({ title: "Błąd", description: `Nie udało się uruchomić ${label}`, variant: "destructive" });
    } finally {
      setCleanupLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Monitor Zasobów
            </CardTitle>
            <CardDescription>Limity Free Plan Supabase i stan storage</CardDescription>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Skanuj</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!data && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Kliknij "Skanuj" aby sprawdzić stan zasobów
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Skanowanie zasobów...</span>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Limits Overview */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    Baza danych
                  </span>
                  <span className="text-muted-foreground">Limit: {data.limits.databaseMaxMB} MB</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sprawdź dokładny rozmiar w Supabase Dashboard → Database → Database Size
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4" />
                    Storage: {data.storage.totalFiles} plików
                  </span>
                  <span className="text-muted-foreground">Limit: {data.limits.storageMaxMB} MB</span>
                </div>
              </div>
            </div>

            {/* Storage Folders */}
            <div>
              <h4 className="text-sm font-medium mb-3">Struktura storage (ObrazkiKsiazek)</h4>
              <div className="space-y-2">
                {data.storage.folders.map((folder) => {
                  const isOrphaned = data.storage.orphanedFolders.includes(folder.name);
                  return (
                    <div key={folder.name} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {folder.name.length > 20 ? folder.name.substring(0, 8) + '...' : folder.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">{folder.fileCount} plików</Badge>
                        {isOrphaned && <Badge variant="destructive" className="text-xs">osierocone</Badge>}
                        {folder.name === 'temp-videos' && data.storage.tempVideoFiles > 0 && (
                          <Badge variant="destructive" className="text-xs">do usunięcia</Badge>
                        )}
                        {folder.name === 'books' && <Badge className="text-xs bg-green-600">używane</Badge>}
                        {folder.name === 'videos' && <Badge className="text-xs bg-green-600">używane</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{data.storage.referencedPaths}</div>
                <div className="text-xs text-muted-foreground">Referencjonowanych ścieżek</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-destructive">{data.storage.orphanedFiles}</div>
                <div className="text-xs text-muted-foreground">Osieroconych plików</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{data.storage.tempVideoFiles}</div>
                <div className="text-xs text-muted-foreground">Temp video plików</div>
              </div>
            </div>

            {/* Cleanup Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => runCleanup('cleanup-unused-images', 'Czyszczenie osieroconych plików')}
                disabled={cleanupLoading !== null || data.storage.orphanedFiles === 0}
              >
                {cleanupLoading === 'cleanup-unused-images' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Wyczyść osierocone ({data.storage.orphanedFiles})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => runCleanup('cleanup-temp-videos', 'Czyszczenie temp-videos')}
                disabled={cleanupLoading !== null || data.storage.tempVideoFiles === 0}
              >
                {cleanupLoading === 'cleanup-temp-videos' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Wyczyść temp-videos ({data.storage.tempVideoFiles})
              </Button>
            </div>

            {/* Free Plan Info */}
            <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
              <p>📊 <strong>Limity Free Plan:</strong> DB 500 MB | Storage 1 GB | Egress 5 GB/mies | Edge Invocations 500K/mies</p>
              <p>⚠️ Cached Egress nie jest mierzalny z poziomu API — sprawdź w Supabase Dashboard → Usage</p>
              <p>🔄 Crony: auto-publish (co 2 min), cleanup-temp-videos (co 1h), czyszczenie logów (co 24h)</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
