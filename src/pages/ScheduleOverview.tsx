import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";

const ScheduleOverview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Harmonogram zbiorczy</h1>
              <p className="text-muted-foreground">
                Wszystkie zaplanowane publikacje ze wszystkich platform
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Powrót
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <ScheduleCalendar />
      </div>
    </div>
  );
};

export default ScheduleOverview;
