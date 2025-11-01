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
import { Loader2, AlertCircle, Wrench, Camera, Upload } from "lucide-react";
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
  customDisplayName?: string; // For custom equipment not in catalog
  isCustom?: boolean; // Flag to identify custom equipment
  originalType?: string; // Track original type for updates when name changes
  replacementCost?: number; // Optional estimated replacement cost
  manufacturer?: string; // Brand/manufacturer name
  model?: string; // Model number/name
}

interface EquipmentManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onAddPendingEquipment?: (equipment: Partial<Equipment>) => void;
}

const currentYear = new Date().getFullYear();

export default function EquipmentManagementModal({
  open,
  onOpenChange,
  property,
  onAddPendingEquipment,
}: EquipmentManagementModalProps) {
  const { toast } = useToast();
  const [useClimateAdjustment, setUseClimateAdjustment] = useState(true);
  const [equipmentData, setEquipmentData] = useState<Record<string, EquipmentFormData>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(property?.id || '');
  const [customEquipmentCounter, setCustomEquipmentCounter] = useState(0);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Fetch all properties for the dropdown
  const { data: properties = [] } = useQuery<PropertyWithOwnerships[]>({
    queryKey: ['/api/properties'],
    enabled: open,
  });

  // Update selected property when property prop changes
  useEffect(() => {
    if (property?.id) {
      setSelectedPropertyId(property.id);
    }
  }, [property?.id]);
  
  // Set first property as default when properties load and none selected
  // BUT only if we're not in pending mode (onAddPendingEquipment present)
  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId && !property?.id && !onAddPendingEquipment) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties.length, selectedPropertyId, property?.id, onAddPendingEquipment]);

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

  // Reset climate adjustment when property changes and has no equipment
  useEffect(() => {
    if (selectedPropertyId && existingEquipment.length === 0) {
      setUseClimateAdjustment(true);
    }
  }, [selectedPropertyId, existingEquipment.length]);

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
  const migrateIsPending = migrateMutation.isPending;
  const migrateIsSuccess = migrateMutation.isSuccess;
  
  useEffect(() => {
    if (open && selectedPropertyId && !isLoading && existingEquipment.length === 0 && !migrateIsPending && !migrateIsSuccess) {
      migrateMutation.mutate();
    }
  }, [open, selectedPropertyId, isLoading, existingEquipment.length, migrateIsPending, migrateIsSuccess]);

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
        const isInCatalog = catalog.some(cat => cat.type === eq.equipmentType);
        // For custom equipment, derive a friendly display name from the type
        const friendlyName = !isInCatalog 
          ? eq.equipmentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : undefined;
        
        initialData[eq.equipmentType] = {
          type: eq.equipmentType,
          selected: true,
          installYear: eq.installYear,
          customLifespan: eq.customLifespanYears ?? undefined,
          isCustom: !isInCatalog,
          customDisplayName: friendlyName,
          originalType: eq.equipmentType, // Track original for updates
          replacementCost: eq.replacementCost ? parseFloat(eq.replacementCost as any) : undefined, // Parse decimal to number
          manufacturer: eq.manufacturer ?? undefined,
          model: eq.model ?? undefined,
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
      const selectedEquipment = Object.values(equipmentData).filter(eq => eq.selected);
      
      // If in pending mode (no property ID but has callback), add to pending equipment
      if (!selectedPropertyId && onAddPendingEquipment) {
        for (const eq of selectedEquipment) {
          let equipmentType = eq.type;
          if (eq.isCustom && eq.customDisplayName) {
            equipmentType = eq.customDisplayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || eq.type;
          }
          
          const pendingEquipmentItem: Partial<Equipment> = {
            equipmentType: equipmentType,
            installYear: eq.installYear,
            customLifespanYears: eq.customLifespan,
            useClimateAdjustment,
            replacementCost: eq.replacementCost,
            manufacturer: eq.manufacturer,
            model: eq.model,
          };
          
          onAddPendingEquipment(pendingEquipmentItem);
        }
        return null; // No property ID to return in pending mode
      }
      
      // Guard against empty property ID in normal mode
      if (!selectedPropertyId) {
        throw new Error('No property selected');
      }

      // Capture property ID and equipment data at mutation start to prevent race conditions if user changes selector mid-save
      const propertyIdForMutation = selectedPropertyId;
      const existingEquipmentForMutation = [...existingEquipment];
      
      // Delete removed equipment
      for (const existing of existingEquipmentForMutation) {
        const stillSelected = selectedEquipment.find(eq => eq.type === existing.equipmentType);
        if (!stillSelected) {
          await apiRequest('DELETE', `/api/equipment/${existing.id}`);
        }
      }

      // Create or update selected equipment
      for (const eq of selectedEquipment) {
        // For custom equipment, convert display name to database format
        let equipmentType = eq.type;
        if (eq.isCustom && eq.customDisplayName) {
          equipmentType = eq.customDisplayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || eq.type;
        }
        
        // For custom equipment that was renamed, find by originalType
        const existing = existingEquipmentForMutation.find(e => 
          e.equipmentType === equipmentType || 
          e.equipmentType === eq.type ||
          (eq.originalType && e.equipmentType === eq.originalType)
        );
        
        const payload = {
          equipmentType: equipmentType,
          installYear: eq.installYear,
          customLifespanYears: eq.customLifespan,
          useClimateAdjustment,
          replacementCost: eq.replacementCost,
          manufacturer: eq.manufacturer,
          model: eq.model,
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
      // If in pending mode, just close the modal
      if (!propertyIdForMutation && onAddPendingEquipment) {
        onOpenChange(false);
        return;
      }
      
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

  const updateCustomDisplayName = (type: string, displayName: string) => {
    // Just update the display name - we'll convert to database format on save
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        customDisplayName: displayName,
      },
    }));
  };

  const updateReplacementCost = (type: string, cost: number | undefined) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        replacementCost: cost,
      },
    }));
  };

  const updateManufacturer = (type: string, manufacturer: string) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        manufacturer: manufacturer || undefined,
      },
    }));
  };

  const updateModel = (type: string, model: string) => {
    setEquipmentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        model: model || undefined,
      },
    }));
  };

  const addCustomEquipment = () => {
    const customType = `custom_${Date.now()}_${customEquipmentCounter}`;
    setCustomEquipmentCounter(prev => prev + 1);
    
    setEquipmentData(prev => ({
      ...prev,
      [customType]: {
        type: customType,
        selected: true,
        installYear: currentYear - 5,
        customLifespan: 15,
        isCustom: true,
        customDisplayName: 'Custom Equipment',
      },
    }));
  };

  const removeCustomEquipment = (type: string) => {
    setEquipmentData(prev => {
      const newData = { ...prev };
      delete newData[type];
      return newData;
    });
  };

  const analyzeEquipmentImage = async (file: File) => {
    setIsAnalyzingImage(true);
    try {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call backend to analyze with OpenAI Vision
      const result = await apiRequest<{
        equipmentType?: string;
        manufacturer?: string;
        model?: string;
        year?: number;
        customDisplayName?: string;
      }>('POST', '/api/equipment/analyze-image', {
        image: base64,
        mimeType: file.type,
      });

      if (result.equipmentType) {
        // Check if this equipment type exists in catalog
        const catalogItem = catalog.find(c => c.type === result.equipmentType);
        
        let targetType = result.equipmentType;
        let isCustomEquipment = !catalogItem;
        
        // If not in catalog, create as custom equipment
        if (isCustomEquipment) {
          targetType = `custom_${Date.now()}_${customEquipmentCounter}`;
          setCustomEquipmentCounter(prev => prev + 1);
        }

        // Update equipment data with recognized information
        setEquipmentData(prev => ({
          ...prev,
          [targetType]: {
            ...prev[targetType],
            type: targetType,
            selected: true,
            installYear: result.year || (currentYear - 5),
            manufacturer: result.manufacturer,
            model: result.model,
            isCustom: isCustomEquipment,
            customDisplayName: result.customDisplayName || result.equipmentType,
          },
        }));

        toast({
          title: "Equipment Recognized!",
          description: `Found ${result.customDisplayName || result.equipmentType}${result.manufacturer ? ` by ${result.manufacturer}` : ''}`,
        });
      } else {
        toast({
          title: "Could not identify equipment",
          description: "Try a clearer photo or enter details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze image. Please try again or enter details manually.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      analyzeEquipmentImage(file);
    }
    // Reset input
    event.target.value = '';
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

        {/* AI Image Recognition */}
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
            id="equipment-image-upload"
            disabled={isAnalyzingImage || !selectedPropertyId}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById('equipment-image-upload')?.click()}
            disabled={isAnalyzingImage || !selectedPropertyId}
            data-testid="button-upload-equipment-image"
          >
            {isAnalyzingImage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Image...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Snap Photo to Auto-Fill Equipment Data
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            AI will recognize equipment type, brand, model, and year from your photo
          </p>
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
                                      <>
                                        <div className="mt-3 grid grid-cols-2 gap-4">
                                          {/* Install Year Section */}
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="font-medium">Install Year: {eq.installYear}</span>
                                              <span className="text-muted-foreground">{age}y old</span>
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
                                          
                                          {/* Lifespan Section */}
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="font-medium">Lifespan (years)</span>
                                              <span className="text-muted-foreground">Default: {item.defaultLifespanYears}y</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                type="number"
                                                min={1}
                                                value={eq.customLifespan || item.defaultLifespanYears}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value);
                                                  if (!isNaN(val) && val >= 1) {
                                                    updateCustomLifespan(item.type, val);
                                                  }
                                                }}
                                                className="h-9"
                                                data-testid={`input-lifespan-${item.type}`}
                                              />
                                              {eq.customLifespan && eq.customLifespan !== item.defaultLifespanYears && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-9 px-3 text-xs text-blue-600 hover:text-blue-700"
                                                  onClick={() => updateCustomLifespan(item.type, undefined)}
                                                  data-testid={`button-reset-lifespan-${item.type}`}
                                                >
                                                  Reset
                                                </Button>
                                              )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Suggested range: {item.lifespanRange.min}-{item.lifespanRange.max}y
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Manufacturer and Model Section */}
                                        <div className="mt-3 grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Manufacturer (optional)</Label>
                                            <Input
                                              placeholder="e.g., Carrier, Rheem"
                                              value={eq.manufacturer || ''}
                                              onChange={(e) => updateManufacturer(item.type, e.target.value)}
                                              className="h-9"
                                              data-testid={`input-manufacturer-${item.type}`}
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Model (optional)</Label>
                                            <Input
                                              placeholder="e.g., 24ABC6"
                                              value={eq.model || ''}
                                              onChange={(e) => updateModel(item.type, e.target.value)}
                                              className="h-9"
                                              data-testid={`input-model-${item.type}`}
                                            />
                                          </div>
                                        </div>
                                      </>
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

                {/* Custom Equipment Section */}
                {Object.entries(equipmentData).some(([_, eq]) => eq.isCustom && eq.selected) && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium">⚪ Custom Equipment</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(equipmentData)
                        .filter(([_, eq]) => eq.isCustom && eq.selected)
                        .map(([type, eq]) => {
                          const age = currentYear - eq.installYear;
                          return (
                            <Card key={type} className="border-primary">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="mb-3">
                                      <Label className="text-xs text-muted-foreground mb-1 block">Equipment Name</Label>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={eq.customDisplayName || eq.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                          onChange={(e) => updateCustomDisplayName(type, e.target.value)}
                                          placeholder="e.g., Solar Panels, Generator, Pool Heater"
                                          className="flex-1"
                                          data-testid={`input-custom-name-${type}`}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeCustomEquipment(type)}
                                          className="text-red-600 hover:text-red-700"
                                          data-testid={`button-remove-${type}`}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-4">
                                      {/* Install Year Section */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="font-medium">Install Year: {eq.installYear}</span>
                                          <span className="text-muted-foreground">{age}y old</span>
                                        </div>
                                        <Slider
                                          value={[eq.installYear]}
                                          onValueChange={(value) => updateInstallYear(type, value[0])}
                                          min={1980}
                                          max={currentYear}
                                          step={1}
                                          className="w-full"
                                          data-testid={`slider-year-${type}`}
                                        />
                                      </div>
                                      
                                      {/* Lifespan Section */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="font-medium">Lifespan (years)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            min={1}
                                            value={eq.customLifespan || 15}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value);
                                              if (!isNaN(val) && val >= 1) {
                                                updateCustomLifespan(type, val);
                                              }
                                            }}
                                            className="h-9"
                                            data-testid={`input-lifespan-${type}`}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Manufacturer and Model Section */}
                                    <div className="mt-3 grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Manufacturer (optional)</Label>
                                        <Input
                                          placeholder="e.g., Carrier, Rheem"
                                          value={eq.manufacturer || ''}
                                          onChange={(e) => updateManufacturer(type, e.target.value)}
                                          className="h-9"
                                          data-testid={`input-manufacturer-${type}`}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Model (optional)</Label>
                                        <Input
                                          placeholder="e.g., 24ABC6"
                                          value={eq.model || ''}
                                          onChange={(e) => updateModel(type, e.target.value)}
                                          className="h-9"
                                          data-testid={`input-model-${type}`}
                                        />
                                      </div>
                                    </div>
                                    
                                    {/* Replacement Cost Section (Optional) */}
                                    <div className="mt-3">
                                      <Label className="text-xs text-muted-foreground mb-1 block">
                                        Replacement Cost (optional)
                                      </Label>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">$</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={100}
                                          value={eq.replacementCost || ''}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            updateReplacementCost(type, isNaN(val) || e.target.value === '' ? undefined : val);
                                          }}
                                          placeholder="e.g., 5000"
                                          className="h-9"
                                          data-testid={`input-replacement-cost-${type}`}
                                        />
                                        {eq.replacementCost && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 px-3 text-xs text-blue-600 hover:text-blue-700"
                                            onClick={() => updateReplacementCost(type, undefined)}
                                            data-testid={`button-clear-cost-${type}`}
                                          >
                                            Clear
                                          </Button>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Used for predictive cost estimates
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Add Custom Equipment Button */}
                <div className="mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomEquipment}
                    className="w-full"
                    data-testid="button-add-custom-equipment"
                  >
                    + Add Custom Equipment
                  </Button>
                </div>
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
