import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, DollarSign, Calculator } from "lucide-react";
import Expenses from "./expenses";
import Revenue from "./revenue";
import Tax from "./tax";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function Financial() {
  return (
    <div className="flex h-screen bg-background" data-testid="page-financial">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Financial" />
        
        <main className="flex-1 overflow-auto p-6 bg-muted/30">
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
        </main>
      </div>
    </div>
  );
}
