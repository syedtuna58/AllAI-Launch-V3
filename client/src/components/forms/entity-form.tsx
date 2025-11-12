import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

const entitySchema = z.object({
  type: z.enum(["Personal", "Joint", "LLC/Corp", "Trust"]),
  name: z.string().min(1, "Entity name is required"),
  state: z.string().optional(),
  ein: z.string().optional(),
  registeredAgent: z.string().optional(),
  renewalMonth: z.number().min(1).max(12).optional(),
  notes: z.string().optional(),
});

interface EntityFormProps {
  onSubmit: (data: z.infer<typeof entitySchema>) => void;
  onCancel?: () => void;
  isLoading: boolean;
  initialData?: Partial<z.infer<typeof entitySchema>>;
}

export default function EntityForm({ onSubmit, onCancel, isLoading, initialData }: EntityFormProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  
  const form = useForm<z.infer<typeof entitySchema>>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      type: "Personal",
      name: "",
      state: "",
      ein: "",
      registeredAgent: "",
      notes: "",
      ...initialData,
    },
  });

  const selectedType = form.watch("type");

  const handleTemplateClick = (type: "Personal" | "Joint" | "LLC/Corp" | "Trust", defaultName: string) => {
    form.setValue("type", type);
    if (!form.getValues("name")) {
      form.setValue("name", defaultName);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Entity Type Template Buttons */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entity Type</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={field.value === "Personal" ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => handleTemplateClick("Personal", "Personal Ownership")}
                  data-testid="button-entity-personal"
                >
                  <span className="text-2xl">👤</span>
                  <span className="text-sm font-medium">Personal</span>
                </Button>
                
                <Button
                  type="button"
                  variant={field.value === "Joint" ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => handleTemplateClick("Joint", "Joint Ownership")}
                  data-testid="button-entity-joint"
                >
                  <span className="text-2xl">👥</span>
                  <span className="text-sm font-medium">Joint</span>
                </Button>
                
                <Button
                  type="button"
                  variant={field.value === "LLC/Corp" ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => handleTemplateClick("LLC/Corp", "My Properties LLC")}
                  data-testid="button-entity-llc"
                >
                  <span className="text-2xl">🏛️</span>
                  <span className="text-sm font-medium">LLC/Corp</span>
                </Button>
                
                <Button
                  type="button"
                  variant={field.value === "Trust" ? "default" : "outline"}
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => handleTemplateClick("Trust", "Family Trust")}
                  data-testid="button-entity-trust"
                >
                  <span className="text-2xl">🏢</span>
                  <span className="text-sm font-medium">Family Trust</span>
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Entity Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entity Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter entity name" 
                  {...field} 
                  data-testid="input-entity-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Optional Fields - Collapsed by Default */}
        <Collapsible open={showOptionalFields} onOpenChange={setShowOptionalFields}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-optional-fields"
            >
              <span>Additional Information (Optional)</span>
              {showOptionalFields ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {(selectedType === "LLC/Corp" || selectedType === "Trust") && (
              <>
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State of Formation</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Delaware, California" 
                          {...field} 
                          data-testid="input-entity-state"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ein"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EIN (Tax ID)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 12-3456789" 
                          {...field} 
                          data-testid="input-entity-ein"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registeredAgent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registered Agent</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., CT Corporation System" 
                          {...field} 
                          data-testid="input-entity-agent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="renewalMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Renewal Month</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-renewal-month">
                            <SelectValue placeholder="Select renewal month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = i + 1;
                            const monthName = new Date(2024, i).toLocaleString('default', { month: 'long' });
                            return (
                              <SelectItem key={month} value={month.toString()}>
                                {monthName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this entity..." 
                      {...field} 
                      data-testid="textarea-entity-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel-entity"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit-entity">
            {isLoading ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update Entity" : "Create Entity")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
