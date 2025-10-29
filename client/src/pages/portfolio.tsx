import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Building2 } from "lucide-react";
import Properties from "./properties";
import Entities from "./entities";

export default function Portfolio() {
  return (
    <div className="space-y-6" data-testid="page-portfolio">
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="properties" data-testid="tab-properties">
            <Building className="h-4 w-4 mr-2" />
            Properties
          </TabsTrigger>
          <TabsTrigger value="entities" data-testid="tab-entities">
            <Building2 className="h-4 w-4 mr-2" />
            Entities
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="properties" className="mt-0">
          <Properties embedded />
        </TabsContent>
        
        <TabsContent value="entities" className="mt-0">
          <Entities embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
