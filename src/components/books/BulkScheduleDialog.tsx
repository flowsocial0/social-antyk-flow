import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";

interface BulkScheduleDialogProps {
  unpublishedCount: number;
  onSchedule: (intervalMinutes: number) => void;
  isScheduling: boolean;
}

const INTERVAL_OPTIONS = [
  { label: "4 minuty", value: 4 },
  { label: "5 minut", value: 5 },
  { label: "15 minut", value: 15 },
  { label: "30 minut", value: 30 },
  { label: "1 godzina", value: 60 },
  { label: "2 godziny", value: 120 },
  { label: "4 godziny", value: 240 },
  { label: "8 godzin", value: 480 },
  { label: "12 godzin", value: 720 },
  { label: "24 godziny", value: 1440 },
];

export const BulkScheduleDialog = ({ 
  unpublishedCount, 
  onSchedule, 
  isScheduling 
}: BulkScheduleDialogProps) => {
  const [open, setOpen] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(15);

  const handleSchedule = () => {
    onSchedule(intervalMinutes);
    setOpen(false);
  };

  const calculateEndTime = () => {
    const totalMinutes = intervalMinutes * (unpublishedCount - 1);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}min` : ''}`;
    }
    return `${minutes} min`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={unpublishedCount === 0}>
          <Clock className="mr-2 h-4 w-4" />
          Zaplanuj wszystkie ({unpublishedCount})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaplanuj publikację wszystkich książek</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Zaplanuj automatyczną publikację {unpublishedCount} książek po kolei z wybranym odstępem czasowym.
          </p>

          <div className="space-y-2">
            <Label htmlFor="interval" className="text-sm font-medium">
              Odstęp między publikacjami
            </Label>
            <Select
              value={intervalMinutes.toString()}
              onValueChange={(value) => setIntervalMinutes(parseInt(value))}
            >
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Liczba książek:</span>
              <span className="font-medium">{unpublishedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pierwsza publikacja:</span>
              <span className="font-medium">Natychmiast</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ostatnia publikacja za:</span>
              <span className="font-medium">{calculateEndTime()}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Pierwsza książka zostanie opublikowana natychmiast, kolejne będą publikowane automatycznie co {intervalMinutes} minut.
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSchedule} disabled={isScheduling}>
              {isScheduling ? "Planowanie..." : "Zaplanuj"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};