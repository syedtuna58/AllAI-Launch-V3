import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, DollarSign, Calculator } from "lucide-react";
import Expenses from "./expenses";
import Revenue from "./revenue";
import Tax from "./tax";

export default function Financial() {
  return (
    <div className="space-y-6" data-testid="page-financial">
      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
          <TabsTrigger value="expenses" data-testid="tab-expenses">
            <Receipt className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <DollarSign className="h-4 w-4 mr-2" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax">
            <Calculator className="h-4 w-4 mr-2" />
            Tax
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses" className="mt-0">
          <Expenses embedded />
        </TabsContent>
        
        <TabsContent value="revenue" className="mt-0">
          <Revenue embedded />
        </TabsContent>
        
        <TabsContent value="tax" className="mt-0">
          <Tax embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
