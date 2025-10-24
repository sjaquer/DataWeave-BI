
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import agentMap from '@/lib/agents.json';

type DaySchedule = {
  active: boolean;
  start: string;
  end: string;
};

type Schedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

const daysOfWeek: (keyof Schedule)[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayLabels: { [key in keyof Schedule]: string } = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export function ScheduleManager({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedAgent && open) {
      setIsLoading(true);
      fetch(`/api/schedules/${selectedAgent}`)
        .then(res => res.json())
        .then(data => setSchedule(data))
        .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el horario." }))
        .finally(() => setIsLoading(false));
    } else {
      setSchedule(null);
    }
  }, [selectedAgent, open, toast]);

  const handleDayChange = (day: keyof Schedule, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule(prev => {
      if (!prev) return null;
      return { ...prev, [day]: { ...prev[day], [field]: value } };
    });
  };

  const handleSave = () => {
    if (!selectedAgent || !schedule) return;
    setIsLoading(true);
    fetch(`/api/schedules/${selectedAgent}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        toast({ title: "Éxito", description: "Horario guardado correctamente." });
        onOpenChange(false);
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    })
    .catch((err) => toast({ variant: "destructive", title: "Error", description: `No se pudo guardar el horario: ${err.message}` }))
    .finally(() => setIsLoading(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar Horarios de Asesores</DialogTitle>
          <DialogDescription>Selecciona un asesor para ver o modificar su horario semanal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Select onValueChange={setSelectedAgent} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un asesor..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(agentMap).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name} ({id})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && <div className="text-center p-8">Cargando horario...</div>}

          {schedule && !isLoading && (
            <div className="space-y-6">
              {daysOfWeek.map(day => (
                <div key={day} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_1fr] items-center gap-x-4 gap-y-2">
                  <div className="flex items-center justify-between sm:justify-end">
                    <Label htmlFor={`${day}-active`} className="font-semibold">{dayLabels[day]}</Label>
                    <Switch
                      id={`${day}-active`}
                      checked={schedule[day].active}
                      onCheckedChange={(checked) => handleDayChange(day, 'active', checked)}
                      className="sm:ml-4"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-3 grid grid-cols-2 gap-4">
                    <Input
                      type="time"
                      value={schedule[day].start}
                      onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                      disabled={!schedule[day].active}
                      aria-label={`Hora de inicio para ${dayLabels[day]}`}
                    />
                    <Input
                      type="time"
                      value={schedule[day].end}
                      onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                      disabled={!schedule[day].active}
                      aria-label={`Hora de fin para ${dayLabels[day]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isLoading || !schedule}>
            {isLoading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
