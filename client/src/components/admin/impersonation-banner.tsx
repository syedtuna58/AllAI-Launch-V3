import { useQuery, useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function ImpersonationBanner() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Check impersonation status
  const { data: impersonationStatus } = useQuery<{ isImpersonating: boolean; orgId?: string; orgName?: string }>({
    queryKey: ["/api/admin/impersonation-status"],
    retry: false,
  });

  // Stop impersonation mutation
  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/stop-impersonation", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Returned to Superadmin View",
        description: "You're now viewing all platform data",
      });
      // Invalidate specific queries that will change when stopping impersonation
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setLocation("/admin-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to return to superadmin view",
        variant: "destructive",
      });
    },
  });

  if (!impersonationStatus?.isImpersonating) {
    return null;
  }

  return (
    <Alert className="mb-6 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
      <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
            Viewing as Organization:
          </span>
          <Badge className="bg-purple-600 text-white">
            {impersonationStatus.orgName}
          </Badge>
          <span className="text-xs text-purple-700 dark:text-purple-300">
            You're viewing this organization's data
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => stopImpersonationMutation.mutate()}
          disabled={stopImpersonationMutation.isPending}
          className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900"
          data-testid="button-stop-impersonation"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Return to Superadmin
        </Button>
      </AlertDescription>
    </Alert>
  );
}
