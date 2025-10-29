import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TestTube2, AlertTriangle, CheckCircle2, Clock, DollarSign, Shield, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PromptTestResult {
  promptName: string;
  promptType: "property_expert" | "safety_first" | "cost_conscious" | "efficiency_optimizer";
  result: {
    category: string;
    subcategory: string;
    urgency: "Low" | "Medium" | "High" | "Critical";
    estimatedComplexity: "Simple" | "Moderate" | "Complex";
    requiredExpertise: string[];
    estimatedDuration: string;
    preliminaryDiagnosis: string;
    troubleshootingSteps: string[];
    contractorType: string;
    specialEquipment: string[];
    safetyRisk: "None" | "Low" | "Medium" | "High";
    reasoning: string;
    suggestedTimeWindow?: string;
    estimatedDurationMinutes?: number;
    timeConfidence?: number;
    timeReasoningNotes?: string;
  };
  executionTime: number;
}

const TEST_SCENARIOS = [
  {
    id: "urgent-leak",
    name: "Urgent Water Leak",
    title: "Water actively leaking from ceiling",
    description: "Tenant called panicking - water is pouring from the living room ceiling. They can see a dark wet spot spreading and water dripping steadily into a bucket. The apartment above is also occupied.",
    category: "Plumbing",
    priority: "Urgent",
    tenantFrustrationLevel: "very_frustrated" as const,
    propertyContext: {
      propertyName: "Downtown Apartments",
      propertyType: "Multi-Family Building",
      yearBuilt: 1985,
      location: "Chicago, IL",
      climate: "Cold winters, hot summers",
      previousIssues: ["Roof leak in 2022", "Pipe freeze in winter 2023"]
    },
    unitContext: {
      unitNumber: "2B",
      unitType: "2BR/1BA",
      floorLevel: "2nd floor (unit above is 3rd floor)",
      knownIssues: ["Old plumbing, scheduled for replacement next year"]
    },
    seasonalContext: {
      season: "Winter",
      temperature: "15°F outside, heating running",
      weatherConditions: "Recent cold snap",
      upcomingEvents: ["Weekend approaching", "Unit above has young family"]
    }
  },
  {
    id: "non-urgent-leak",
    name: "Slow Drip Under Sink",
    description: "Tenant noticed a slow drip under the kitchen sink when checking the cabinet. Small puddle has formed but it's not spreading. Drips about once every 10 seconds. They placed a bowl to catch it.",
    title: "Kitchen sink dripping underneath",
    category: "Plumbing",
    priority: "Medium",
    tenantFrustrationLevel: "calm" as const,
    propertyContext: {
      propertyName: "Suburban House Rental",
      propertyType: "Single Family Home",
      yearBuilt: 2010,
      location: "Austin, TX",
      climate: "Hot, dry summers",
      previousIssues: ["None in past 2 years"]
    },
    unitContext: {
      unitNumber: "N/A (Single Family)",
      unitType: "3BR/2BA House",
      floorLevel: "Ground level",
      knownIssues: []
    },
    seasonalContext: {
      season: "Spring",
      temperature: "75°F, comfortable",
      weatherConditions: "Clear and dry",
      upcomingEvents: []
    }
  },
  {
    id: "minor-hvac",
    name: "AC Not Cooling Well",
    description: "The AC is running but not cooling as well as usual. Room temperature is 78°F when thermostat is set to 72°F. Unit turns on and air flows, but air doesn't feel very cold. Filter was changed last month.",
    title: "Air conditioning not cooling effectively",
    category: "HVAC",
    priority: "Medium",
    tenantFrustrationLevel: "concerned" as const,
    propertyContext: {
      propertyName: "Condo Complex A",
      propertyType: "Condo",
      yearBuilt: 2015,
      location: "Phoenix, AZ",
      climate: "Desert climate, very hot summers",
      previousIssues: ["HVAC serviced annually, last service 3 months ago"]
    },
    unitContext: {
      unitNumber: "Unit 304",
      unitType: "2BR/2BA Condo",
      floorLevel: "3rd floor (top floor, lots of sun exposure)",
      knownIssues: ["Top floor gets very hot in summer"]
    },
    seasonalContext: {
      season: "Summer",
      temperature: "105°F outside, peak summer heat",
      weatherConditions: "Heat wave - temperatures above 100°F for 5 days",
      upcomingEvents: ["Heat wave expected to continue for 3 more days"]
    }
  },
  {
    id: "serious-hvac",
    name: "No Heat - Frustrated Tenant",
    description: "Furnace completely stopped working last night. No heat at all - thermostat shows heat is on but nothing happens. Temperature inside is now 55°F and dropping. Tenant has elderly parent visiting and a toddler. They've called twice already and are very upset. This is the second furnace issue this winter.",
    title: "Furnace not working - no heat in unit",
    category: "HVAC",
    priority: "Critical",
    tenantFrustrationLevel: "very_frustrated" as const,
    propertyContext: {
      propertyName: "Lakeside Apartments",
      propertyType: "Apartment Building",
      yearBuilt: 1978,
      location: "Minneapolis, MN",
      climate: "Very cold winters",
      previousIssues: [
        "Furnace issues earlier this winter (temp fix applied)",
        "Building HVAC system is old, scheduled for replacement next year",
        "Multiple tenant complaints about heating this season"
      ]
    },
    unitContext: {
      unitNumber: "Unit 1A",
      unitType: "2BR/1BA Apartment",
      floorLevel: "Ground floor (coldest units)",
      knownIssues: ["Heating has been problematic all winter", "Windows are drafty"]
    },
    seasonalContext: {
      season: "Winter",
      temperature: "-5°F outside, windchill -20°F",
      weatherConditions: "Extreme cold warning, dangerous wind chills",
      upcomingEvents: [
        "Temperature expected to stay below 0°F for next 3 days",
        "Tenant has elderly guest and toddler in unit",
        "Other tenants in building may also be affected"
      ]
    }
  }
];

const getPromptIcon = (type: string) => {
  switch (type) {
    case "property_expert": return <TestTube2 className="h-4 w-4" />;
    case "safety_first": return <Shield className="h-4 w-4" />;
    case "cost_conscious": return <DollarSign className="h-4 w-4" />;
    case "efficiency_optimizer": return <Zap className="h-4 w-4" />;
    default: return null;
  }
};

const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case "Critical": return "destructive";
    case "High": return "destructive";
    case "Medium": return "default";
    case "Low": return "secondary";
    default: return "default";
  }
};

const getSafetyColor = (risk: string) => {
  switch (risk) {
    case "High": return "destructive";
    case "Medium": return "default";
    case "Low": return "secondary";
    case "None": return "outline";
    default: return "outline";
  }
};

export default function PromptTester() {
  const { isAuthenticated } = useAuth();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [testResults, setTestResults] = useState<PromptTestResult[] | null>(null);

  const testMutation = useMutation({
    mutationFn: async (request: any) => {
      const response = await apiRequest("POST", "/api/test-triage-prompts", request);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(data.results);
    }
  });

  const handleLoadScenario = (scenarioId: string) => {
    const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      setSelectedScenario(scenarioId);
      setCustomTitle(scenario.title);
      setCustomDescription(scenario.description);
    }
  };

  const handleRunTest = () => {
    const scenario = selectedScenario 
      ? TEST_SCENARIOS.find(s => s.id === selectedScenario)
      : null;

    const request = {
      title: customTitle || "Test maintenance request",
      description: customDescription || "No description provided",
      category: scenario?.category,
      priority: scenario?.priority,
      tenantFrustrationLevel: scenario?.tenantFrustrationLevel,
      propertyContext: scenario?.propertyContext,
      unitContext: scenario?.unitContext,
      seasonalContext: scenario?.seasonalContext
    };

    testMutation.mutate(request);
  };

  if (!isAuthenticated) {
    return <div>Please log in to access the prompt tester.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Triage Prompt Tester</h1>
        <p className="text-muted-foreground">
          Compare different AI triage approaches to find the most effective prompt strategy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Scenarios</CardTitle>
              <CardDescription>Pre-configured test cases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {TEST_SCENARIOS.map((scenario) => (
                <Button
                  key={scenario.id}
                  variant={selectedScenario === scenario.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => handleLoadScenario(scenario.id)}
                  data-testid={`button-scenario-${scenario.id}`}
                >
                  <div className="text-left">
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {scenario.category} • {scenario.priority}
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Issue Title</Label>
                <Input
                  id="title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Describe the issue briefly"
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Detailed description of the issue"
                  rows={6}
                  data-testid="input-description"
                />
              </div>

              <Button
                onClick={handleRunTest}
                disabled={testMutation.isPending || !customTitle || !customDescription}
                className="w-full"
                data-testid="button-run-test"
              >
                {testMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing All Prompts...
                  </>
                ) : (
                  <>
                    <TestTube2 className="mr-2 h-4 w-4" />
                    Run Prompt Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {testMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <div>
                    <p className="text-lg font-medium">Analyzing with all 4 prompt strategies...</p>
                    <p className="text-sm text-muted-foreground">This may take 10-20 seconds</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {testMutation.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to test prompts: {(testMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {testResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Comparison Results</h2>
                <Badge variant="outline" data-testid="text-result-count">
                  {testResults.length} Prompt Variations Tested
                </Badge>
              </div>

              <Tabs defaultValue="comparison" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
                  <TabsTrigger value="detailed">Detailed View</TabsTrigger>
                </TabsList>

                <TabsContent value="comparison" className="space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {testResults.map((result, idx) => (
                      <Card key={idx} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getPromptIcon(result.promptType)}
                              <CardTitle className="text-lg">{result.promptName}</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {result.executionTime}ms
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Urgency:</span>
                              <Badge variant={getUrgencyColor(result.result.urgency) as any} className="ml-2">
                                {result.result.urgency}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Safety:</span>
                              <Badge variant={getSafetyColor(result.result.safetyRisk) as any} className="ml-2">
                                {result.result.safetyRisk}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Complexity:</span>
                              <span className="ml-2 font-medium">{result.result.estimatedComplexity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Duration:</span>
                              <span className="ml-2 font-medium">{result.result.estimatedDuration}</span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Category</div>
                            <div className="text-sm">{result.result.category} • {result.result.subcategory}</div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Diagnosis</div>
                            <div className="text-sm">{result.result.preliminaryDiagnosis}</div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Reasoning</div>
                            <div className="text-sm text-muted-foreground">{result.result.reasoning}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="detailed" className="space-y-4">
                  {testResults.map((result, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          {getPromptIcon(result.promptType)}
                          <CardTitle>{result.promptName}</CardTitle>
                          <Badge variant="outline" className="ml-auto">
                            {result.executionTime}ms
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm font-medium mb-1">Urgency</div>
                            <Badge variant={getUrgencyColor(result.result.urgency) as any}>
                              {result.result.urgency}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">Safety Risk</div>
                            <Badge variant={getSafetyColor(result.result.safetyRisk) as any}>
                              {result.result.safetyRisk}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">Complexity</div>
                            <div className="text-sm">{result.result.estimatedComplexity}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">Contractor</div>
                            <div className="text-sm">{result.result.contractorType}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Category & Subcategory</div>
                          <div>{result.result.category} • {result.result.subcategory}</div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Preliminary Diagnosis</div>
                          <p className="text-sm text-muted-foreground">{result.result.preliminaryDiagnosis}</p>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Reasoning</div>
                          <p className="text-sm text-muted-foreground">{result.result.reasoning}</p>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Required Expertise</div>
                          <div className="flex flex-wrap gap-2">
                            {result.result.requiredExpertise.map((skill, i) => (
                              <Badge key={i} variant="secondary">{skill}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Troubleshooting Steps</div>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            {result.result.troubleshootingSteps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        {result.result.specialEquipment.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">Special Equipment</div>
                            <div className="flex flex-wrap gap-2">
                              {result.result.specialEquipment.map((equipment, i) => (
                                <Badge key={i} variant="outline">{equipment}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.result.timeReasoningNotes && (
                          <div>
                            <div className="text-sm font-medium mb-2">Scheduling Recommendation</div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className="text-muted-foreground">Window:</span> {result.result.suggestedTimeWindow}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Duration:</span> {result.result.estimatedDurationMinutes} minutes
                              </div>
                              <div>
                                <span className="text-muted-foreground">Confidence:</span> {((result.result.timeConfidence || 0) * 100).toFixed(0)}%
                              </div>
                              <p className="text-muted-foreground mt-2">{result.result.timeReasoningNotes}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!testResults && !testMutation.isPending && !testMutation.isError && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <TestTube2 className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">No Results Yet</p>
                    <p className="text-sm text-muted-foreground">
                      Select a test scenario or enter custom details, then click "Run Prompt Test"
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
