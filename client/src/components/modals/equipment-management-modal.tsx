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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Wrench } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment, Property } from "@shared/schema";

// Extended property type that includes ownership information
type PropertyWithOwnerships = Property & {
  status?: "Active" | "Archived";
  ownerships?: Array<{
    entityId: string;
    entityName?: string;
    entityType?: string;
    percent: number;
  }>;
};

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
  property?: Property;
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
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(property?.id || '');

  // Fetch all properties for the dropdown
  const { data: properties = [] } = useQuery<PropertyWithOwnerships[]>({
    queryKey: ['/api/properties'],
    enabled: open,
  });

  // Update selected property when property prop changes or when properties load
  useEffect(() => {
    if (property?.id) {
      setSelectedPropertyId(property.id);
    } else if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [property?.id, properties]);

  // Reset climate adjustment and migration state when property changes
  useEffect(() => {
    if (selectedPropertyId) {
      if (existingEquipment.length === 0) {
        setUseClimateAdjustment(true);
      }
      // Reset migration mutation so it can run for this property if needed
      migrateMutation.reset();
    }
  }, [selectedPropertyId]);

  // Get the currently selected property object
  const currentProperty = properties.find(p => p.id === selectedPropertyId);

  // Fetch equipment catalog
  const { data: catalog = [] } = useQuery<EquipmentDefinition[]>({
    queryKey: ['/api/equipment-catalog'],
  });

  // Fetch existing equipment for the selected property
  const { data: existingEquipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/properties', selectedPropertyId, 'equipment'],
    enabled: open && !!selectedPropertyId,
  });

  // Migration mutation to import existing property equipment data
  const migrateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/equipment/migrate');
    },
    onSuccess: async (data: any) => {
      if (data.importedCount > 0) {
        toast({
          title: "Equipment Imported",
          description: `Successfully imported ${data.importedCount} equipment items from your properties.`,
        });
        // Refresh equipment data for this property
        await queryClient.invalidateQueries({ queryKey: ['/api/properties', selectedPropertyId, 'equipment'] });
        // Trigger predictive insights generation
        await apiRequest('POST', '/api/predictive-insights/generate');
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

  // Auto-migrate on first load if no equipment exists yet and we have a valid property selected
  useEffect(() => {
    if (open && selectedPropertyId && !isLoading && existingEquipment.length === 0 && !migrateMutation.isPending && !migrateMutation.isSuccess) {
      migrateMutation.mutate();
    }
  }, [open, selectedPropertyId, isLoading, existingEquipment.length]);

  // Initialize form data when existing equipment loads or property changes
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
    } else if (catalog.length > 0) {
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
  }, [existingEquipment, catalog, selectedPropertyId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Guard against empty property ID
      if (!selectedPropertyId) {
        throw new Error('No property selected');
      }

      // Capture property ID and equipment data at mutation start to prevent race conditions if user changes selector mid-save
      const propertyIdForMutation = selectedPropertyId;
      const existingEquipmentForMutation = [...existingEquipment];

      const selectedEquipment = Object.values(equipmentData).filter(eq => eq.selected);
      
      // Delete removed equipment
      for (const existing of existingEquipmentForMutation) {
        const stillSelected = selectedEquipment.find(eq => eq.type === existing.equipmentType);
        if (!stillSelected) {
          await apiRequest('DELETE', `/api/equipment/${existing.id}`);
        }
      }

      // Create or update selected equipment
      for (const eq of selectedEquipment) {
        const existing = existingEquipmentForMutation.find(e => e.equipmentType === eq.type);
        
        const payload = {
          equipmentType: eq.type,
          installYear: eq.installYear,
          customLifespanYears: eq.customLifespan,
          useClimateAdjustment,
        };

        if (existing) {
          // Update existing
          await apiRequest('PUT', `/api/equipment/${existing.id}`, payload);
        } else {
          // Create new
          await apiRequest('POST', `/api/properties/${propertyIdForMutation}/equipment`, payload);
        }
      }
      
      return propertyIdForMutation;
    },
    onSuccess: async (propertyIdForMutation) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyIdForMutation, 'equipment'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/predictive-insights'] });
      
      // Trigger insights regeneration
      await apiRequest('POST', '/api/predictive-insights/generate');
      
      toast({
        title: "Equipment saved",
        description: "Equipment tracking updated successfully. Insights will be refreshed.",
      });
      
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Equipment save error:', error);
      toast({
        title: "Error",
        description: `Failed to save equipment: ${error instanceof Error ? error.message : 'Please try again.'}`,
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

  const updateCustomLifespan = (type: string, lifespan: number | undefined) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        customLifespan: lifespan,
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
            Equipment Tracking
          </DialogTitle>
          <DialogDescription>
            Track equipment at this property to receive predictive maintenance insights.
            We'll estimate replacement dates using industry-standard lifespans.
          </DialogDescription>
        </DialogHeader>

        {/* Property Selector */}
        <div className="space-y-2">
          <Label htmlFor="property-select">Property</Label>
          <Select 
            value={selectedPropertyId} 
            onValueChange={setSelectedPropertyId}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger id="property-select" data-testid="select-property">
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(prop => (
                <SelectItem key={prop.id} value={prop.id} data-testid={`property-option-${prop.id}`}>
                  {prop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
                    Adjust lifespans for {currentProperty?.state || 'your'} climate (e.g., shorter roof life in cold states)
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
                                      <div className="mt-3 space-y-4">
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between text-xs">
                                            <span>Install Year: {eq.installYear}</span>
                                            <span className="text-muted-foreground">{age} years old</span>
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
                                        
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between text-xs">
                                            <span>Lifespan: ~{eq.customLifespan || item.defaultLifespanYears} years</span>
                                            {eq.customLifespan && eq.customLifespan !== item.defaultLifespanYears && (
                                              <button
                                                type="button"
                                                onClick={() => updateCustomLifespan(item.type, undefined)}
                                                className="text-blue-600 hover:text-blue-700 underline"
                                              >
                                                Reset to default
                                              </button>
                                            )}
                                          </div>
                                          <Slider
                                            value={[eq.customLifespan || item.defaultLifespanYears]}
                                            onValueChange={(value) => updateCustomLifespan(item.type, value[0])}
                                            min={item.lifespanRange.min}
                                            max={item.lifespanRange.max}
                                            step={1}
                                            className="w-full"
                                            data-testid={`slider-lifespan-${item.type}`}
                                          />
                                          <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{item.lifespanRange.min}y</span>
                                            <span className="text-center">Default: {item.defaultLifespanYears}y</span>
                                            <span>{item.lifespanRange.max}y</span>
                                          </div>
                                        </div>
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
                disabled={saveMutation.isPending || !selectedPropertyId}
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
