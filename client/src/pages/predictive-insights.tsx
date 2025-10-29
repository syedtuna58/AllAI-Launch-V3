import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, TrendingUp, Wrench, DollarSign, Calendar, Target, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function PredictiveInsights() {
  const { toast } = useToast();
  
  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['/api/predictive-insights'],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/predictive-insights/generate", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-insights'] });
      toast({
        title: "Predictions Generated",
        description: "Predictive analytics have been updated based on latest data.",
      });
    },
  });

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'equipment_failure': return <Wrench className="h-5 w-5" />;
      case 'high_maintenance_unit': return <AlertTriangle className="h-5 w-5" />;
      case 'problematic_contractor': return <TrendingUp className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "secondary";
    if (confidence >= 0.8) return "default";
    if (confidence >= 0.6) return "secondary";
    return "outline";
  };

  const InsightCard = ({ insight }: { insight: any }) => (
    <Card className="hover:shadow-md transition-shadow" data-testid={`insight-${insight.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-blue-600 dark:text-blue-400">
              {getInsightIcon(insight.insightType)}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">
                {insight.prediction}
              </CardTitle>
              <CardDescription className="mt-1">
                {insight.reasoning}
              </CardDescription>
            </div>
          </div>
          <Badge variant={getConfidenceColor(parseFloat(insight.confidence))} data-testid={`confidence-${insight.id}`}>
            {Math.round(parseFloat(insight.confidence || 0) * 100)}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {insight.predictedDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Predicted Date</p>
                <p className="font-medium">{format(new Date(insight.predictedDate), 'MMM d, yyyy')}</p>
              </div>
            </div>
          )}
          {insight.estimatedCost && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="font-medium">${Math.round(parseFloat(insight.estimatedCost))}</p>
              </div>
            </div>
          )}
          {insight.basedOnDataPoints && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Based On</p>
                <p className="font-medium">{insight.basedOnDataPoints} data points</p>
              </div>
            </div>
          )}
        </div>

        {insight.recommendations && insight.recommendations.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recommendations:</p>
            <ul className="list-disc list-inside space-y-1">
              {insight.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const groupedInsights = {
    equipment_failure: insights.filter((i: any) => i.insightType === 'equipment_failure'),
    high_maintenance_unit: insights.filter((i: any) => i.insightType === 'high_maintenance_unit'),
    problematic_contractor: insights.filter((i: any) => i.insightType === 'problematic_contractor'),
    other: insights.filter((i: any) => !['equipment_failure', 'high_maintenance_unit', 'problematic_contractor'].includes(i.insightType)),
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title-insights">🔮 Predictive Maintenance</h1>
          <p className="text-muted-foreground">
            AI-powered predictions for equipment failures and maintenance needs
          </p>
        </div>
        <Button 
          onClick={() => generateMutation.mutate()} 
          disabled={generateMutation.isPending}
          data-testid="button-generate-predictions"
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Predictions
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Predictions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Generate Predictions" to analyze your maintenance history and get AI-powered insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Equipment Failure Predictions */}
          {groupedInsights.equipment_failure.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Equipment Failure Predictions
                <Badge variant="secondary">{groupedInsights.equipment_failure.length}</Badge>
              </h2>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {groupedInsights.equipment_failure.map((insight: any) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* High Maintenance Units */}
          {groupedInsights.high_maintenance_unit.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                High Maintenance Units
                <Badge variant="secondary">{groupedInsights.high_maintenance_unit.length}</Badge>
              </h2>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {groupedInsights.high_maintenance_unit.map((insight: any) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Contractor Performance */}
          {groupedInsights.problematic_contractor.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                Contractor Performance Alerts
                <Badge variant="secondary">{groupedInsights.problematic_contractor.length}</Badge>
              </h2>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {groupedInsights.problematic_contractor.map((insight: any) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Other Insights */}
          {groupedInsights.other.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Other Insights
                <Badge variant="secondary">{groupedInsights.other.length}</Badge>
              </h2>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {groupedInsights.other.map((insight: any) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
