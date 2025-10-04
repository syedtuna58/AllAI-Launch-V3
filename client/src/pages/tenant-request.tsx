import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Mic, Image as ImageIcon, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import type { SmartCase } from "@shared/schema";

export default function TenantRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [attachments, setAttachments] = useState<File[]>([]);


  const updateCaseMutation = useMutation({
    mutationFn: async ({ caseId, data }: { caseId: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/cases/${caseId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Request submitted",
        description: "Your maintenance request has been submitted successfully. We'll get back to you soon!",
      });
      setDescription("");
      setAnalysis(null);
      setAttachments([]);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message,
      });
    },
  });

  const handleAnalyze = async () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "Missing description",
        description: "Please describe your maintenance issue",
      });
      return;
    }

    setAnalyzing(true);
    try {
      if (analysis?.caseId) {
        const deleteRes = await apiRequest('DELETE', `/api/cases/${analysis.caseId}`, undefined);
        if (!deleteRes.ok) {
          console.warn('Failed to delete previous draft');
        }
      }

      const caseRes = await apiRequest('POST', '/api/cases', {
        title: "Tenant Maintenance Request",
        description: description,
        status: "draft",
        type: "maintenance",
        priority: "medium",
      });
      const tempCase = await caseRes.json();

      const triageRes = await apiRequest('POST', `/api/cases/${tempCase.id}/ai-triage`, {
        userMessage: description,
        attachments: attachments.map(f => f.name),
      });
      const triageResult = await triageRes.json();

      setAnalysis({
        caseId: tempCase.id,
        ...triageResult,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: (error as Error).message,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!analysis) return;

    await updateCaseMutation.mutateAsync({
      caseId: analysis.caseId,
      data: {
        title: analysis.suggestedTitle || "Maintenance Request",
        status: "open",
        priority: analysis.urgency || "medium",
        category: analysis.category || "general",
        aiTriageJson: {
          summary: analysis.summary,
          category: analysis.category,
          urgency: analysis.urgency,
          safetyWarning: analysis.safetyWarning,
          estimatedCost: analysis.estimatedCost,
          recommendedActions: analysis.recommendedActions,
          suggestedTitle: analysis.suggestedTitle,
          analyzedAt: new Date().toISOString(),
        },
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div data-testid="page-tenant-request" className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Report Maintenance Issue" />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card data-testid="card-request-form">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Mailla AI Assistant
                </CardTitle>
                <CardDescription>
                  Describe your maintenance issue in your own words. Our AI will analyze it and help route it to the right person.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="description" className="text-sm font-medium mb-2 block">
                    What's the issue?
                  </label>
                  <Textarea
                    id="description"
                    data-testid="input-description"
                    placeholder="For example: 'The toilet in my bathroom is running constantly and won't stop filling' or 'My heater isn't working and it's getting cold'"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Add photos or voice notes (optional)</label>
                  <div className="flex gap-2">
                    <Button
                      data-testid="button-upload-image"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Upload Photos
                    </Button>
                    <Button
                      data-testid="button-record-audio"
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Record Audio (Coming Soon)
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((file, i) => (
                        <Badge key={i} variant="secondary" data-testid={`badge-attachment-${i}`}>
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  data-testid="button-analyze"
                  onClick={handleAnalyze}
                  disabled={analyzing || !description.trim()}
                  className="w-full"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI is analyzing your request...
                    </>
                  ) : (
                    "Analyze & Submit"
                  )}
                </Button>
              </CardContent>
            </Card>

            {analyzing && (
              <Card data-testid="card-analyzing">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Understanding your issue...
                    </div>
                    <Progress value={33} className="h-2" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Identifying category and urgency...
                    </div>
                    <Progress value={66} className="h-2" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finding the best contractor...
                    </div>
                    <Progress value={90} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis && !analyzing && (
              <Card data-testid="card-analysis-result">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    AI Analysis Complete
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Category</div>
                      <Badge variant="outline" data-testid="text-category">
                        {analysis.category || "General"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Priority</div>
                      <Badge variant={getPriorityColor(analysis.urgency)} data-testid="text-urgency">
                        {analysis.urgency || "Medium"}
                      </Badge>
                    </div>
                  </div>

                  {analysis.safetyWarning && (
                    <Alert variant="destructive" data-testid="alert-safety-warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Safety Warning:</strong> {analysis.safetyWarning}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">What we understood</div>
                    <p className="text-sm" data-testid="text-summary">
                      {analysis.summary || "We'll review your request and assign it to the appropriate person."}
                    </p>
                  </div>

                  {analysis.estimatedCost && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">Estimated Cost</div>
                      <p className="text-lg font-semibold" data-testid="text-estimated-cost">
                        ${analysis.estimatedCost.min} - ${analysis.estimatedCost.max}
                      </p>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      data-testid="button-confirm-submit"
                      onClick={handleSubmit}
                      disabled={updateCaseMutation.isPending}
                      className="w-full"
                    >
                      {updateCaseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Confirm & Submit Request"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!analysis && !analyzing && (
              <Card data-testid="card-info">
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground space-y-2">
                    <Info className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      Our AI assistant will help identify the issue, determine its urgency, and route it to the right person for quick resolution.
                    </p>
                    <p className="text-xs">
                      Typical response time: 24-48 hours for routine issues, 2-4 hours for urgent issues
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
