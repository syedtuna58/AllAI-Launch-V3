import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, Wrench } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment, Property } from "@shared/schema";

interface EquipmentDefinition {
  type: string;
  displayName: string;
  category: 'critical' | 'moderate' | 'non-critical';
  defaultLifespanYears: number;
  lifespanRange: { min: number; max: number };
  description: string;
}

interface EquipmentFormData {
  type: string;
  selected: boolean;
  installYear: number;
  customLifespan?: number;
}

interface EquipmentManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
}

const currentYear = new Date().getFullYear();

export default function EquipmentManagementModal({
  open,
  onOpenChange,
  property,
}: EquipmentManagementModalProps) {
  const { toast } = useToast();
  const [useClimateAdjustment, setUseClimateAdjustment] = useState(true);
  const [equipmentData, setEquipmentData] = useState<Record<string, EquipmentFormData>>({});

  // Fetch equipment catalog
  const { data: catalog = [] } = useQuery<EquipmentDefinition[]>({
    queryKey: ['/api/equipment-catalog'],
  });

  // Fetch existing equipment for this property
  const { data: existingEquipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/properties', property.id, 'equipment'],
    enabled: open,
  });

  // Migration mutation to import existing property equipment data
  const migrateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/equipment/migrate', 'POST');
    },
    onSuccess: async (data: any) => {
      if (data.importedCount > 0) {
        toast({
          title: "Equipment Imported",
          description: `Successfully imported ${data.importedCount} equipment items from your properties.`,
        });
        // Refresh equipment data for this property
        await queryClient.invalidateQueries({ queryKey: ['/api/properties', property.id, 'equipment'] });
        // Trigger predictive insights generation
        await apiRequest('/api/predictive-insights/generate', 'POST');
        // Refresh predictions
        await queryClient.invalidateQueries({ queryKey: ['/api/predictive-insights'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Migration Failed",
        description: "Failed to import equipment data. Please try adding equipment manually.",
        variant: "destructive",
      });
    },
  });

  // Auto-migrate on first load if no equipment exists yet
  useEffect(() => {
    if (open && !isLoading && existingEquipment.length === 0 && !migrateMutation.isPending && !migrateMutation.isSuccess) {
      migrateMutation.mutate();
    }
  }, [open, isLoading, existingEquipment.length]);

  // Initialize form data when existing equipment loads
  useEffect(() => {
    if (existingEquipment.length > 0 && catalog.length > 0) {
      const initialData: Record<string, EquipmentFormData> = {};
      
      // Load climate adjustment preference from first equipment item (all should be same per property)
      const firstEquipment = existingEquipment[0];
      if (firstEquipment && firstEquipment.useClimateAdjustment !== undefined && firstEquipment.useClimateAdjustment !== null) {
        setUseClimateAdjustment(firstEquipment.useClimateAdjustment);
      }
      
      existingEquipment.forEach(eq => {
        initialData[eq.equipmentType] = {
          type: eq.equipmentType,
          selected: true,
          installYear: eq.installYear,
          customLifespan: eq.customLifespanYears ?? undefined,
        };
      });

      // Set unselected catalog items
      catalog.forEach(def => {
        if (!initialData[def.type]) {
          initialData[def.type] = {
            type: def.type,
            selected: false,
            installYear: currentYear - Math.floor(def.defaultLifespanYears / 2),
            customLifespan: undefined,
          };
        }
      });

      setEquipmentData(initialData);
    } else if (catalog.length > 0 && Object.keys(equipmentData).length === 0) {
      // Initialize with defaults if no existing equipment
      const initialData: Record<string, EquipmentFormData> = {};
      
      catalog.forEach(def => {
        initialData[def.type] = {
          type: def.type,
          selected: false,
          installYear: currentYear - Math.floor(def.defaultLifespanYears / 2),
          customLifespan: undefined,
        };
      });

      setEquipmentData(initialData);
    }
  }, [existingEquipment, catalog]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedEquipment = Object.values(equipmentData).filter(eq => eq.selected);
      
      // Delete removed equipment
      for (const existing of existingEquipment) {
        const stillSelected = selectedEquipment.find(eq => eq.type === existing.equipmentType);
        if (!stillSelected) {
          await apiRequest(`/api/equipment/${existing.id}`, 'DELETE');
        }
      }

      // Create or update selected equipment
      for (const eq of selectedEquipment) {
        const existing = existingEquipment.find(e => e.equipmentType === eq.type);
        
        const payload = {
          equipmentType: eq.type,
          installYear: eq.installYear,
          customLifespanYears: eq.customLifespan,
          useClimateAdjustment,
        };

        if (existing) {
          // Update existing
          await apiRequest(`/api/equipment/${existing.id}`, 'PUT', payload);
        } else {
          // Create new
          await apiRequest(`/api/properties/${property.id}/equipment`, 'POST', payload);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/properties', property.id, 'equipment'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/predictive-insights'] });
      
      // Trigger insights regeneration
      await apiRequest('/api/predictive-insights/generate', 'POST');
      
      toast({
        title: "Equipment saved",
        description: "Equipment tracking updated successfully. Insights will be refreshed.",
      });
      
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save equipment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleEquipment = (type: string) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        selected: !prev[type]?.selected,
      },
    }));
  };

  const updateInstallYear = (type: string, year: number) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        installYear: year,
      },
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'critical':
        return '🔴';
      case 'moderate':
        return '🟡';
      case 'non-critical':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'critical':
        return 'Critical - Failures can cause property damage';
      case 'moderate':
        return 'Moderate - Important for comfort and function';
      case 'non-critical':
        return 'Non-Critical - Easily replaceable';
      default:
        return '';
    }
  };

  const groupedCatalog = catalog.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, EquipmentDefinition[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Equipment Tracking - {property.name}
          </DialogTitle>
          <DialogDescription>
            Track equipment at this property to receive predictive maintenance insights.
            We'll estimate replacement dates using industry-standard lifespans.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  checked={useClimateAdjustment}
                  onCheckedChange={setUseClimateAdjustment}
                  data-testid="switch-climate-adjustment"
                />
                <div>
                  <Label className="text-sm font-medium">Climate Adjustment</Label>
                  <p className="text-xs text-muted-foreground">
                    Adjust lifespans for {property.state} climate (e.g., shorter roof life in cold states)
                  </p>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {(['critical', 'moderate', 'non-critical'] as const).map(category => (
                  groupedCatalog[category]?.length > 0 && (
                    <div key={category}>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <span>{getCategoryIcon(category)}</span>
                        <span>{getCategoryLabel(category)}</span>
                      </h4>
                      <div className="space-y-3">
                        {groupedCatalog[category].map(item => {
                          const eq = equipmentData[item.type];
                          const age = eq ? currentYear - eq.installYear : 0;

                          return (
                            <Card key={item.type} className={eq?.selected ? "border-primary" : ""}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={eq?.selected || false}
                                    onCheckedChange={() => toggleEquipment(item.type)}
                                    data-testid={`checkbox-equipment-${item.type}`}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <Label className="font-medium">{item.displayName}</Label>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                      </div>
                                      {eq?.selected && (
                                        <span className="text-xs text-muted-foreground">
                                          {age} years old
                                        </span>
                                      )}
                                    </div>

                                    {eq?.selected && (
                                      <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span>Install Year: {eq.installYear}</span>
                                          <span>Lifespan: ~{item.defaultLifespanYears} years</span>
                                        </div>
                                        <Slider
                                          value={[eq.installYear]}
                                          onValueChange={(value) => updateInstallYear(item.type, value[0])}
                                          min={1980}
                                          max={currentYear}
                                          step={1}
                                          className="w-full"
                                          data-testid={`slider-year-${item.type}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-blue-900 dark:text-blue-100">
                Predictive insights will update automatically based on equipment age and climate.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-equipment"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-equipment"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Equipment
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
