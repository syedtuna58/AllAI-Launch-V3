import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MessageSquare, Bot, Settings as SettingsIcon, Save } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const channelSettingsSchema = z.object({
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  sendgridFromEmail: z.string().email().optional().or(z.literal("")),
  openaiApiKey: z.string().optional(),
  autoRespondEnabled: z.boolean().default(true),
  autoCreateCasesEnabled: z.boolean().default(true),
  mayaPersonality: z.enum(["professional", "friendly", "empathetic"]).default("empathetic"),
});

type ChannelSettingsForm = z.infer<typeof channelSettingsSchema>;

export default function ChannelSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<ChannelSettingsForm>({
    queryKey: ['/api/channel-settings'],
  });

  const form = useForm<ChannelSettingsForm>({
    resolver: zodResolver(channelSettingsSchema),
    defaultValues: {
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioPhoneNumber: "",
      sendgridApiKey: "",
      sendgridFromEmail: "",
      openaiApiKey: "",
      autoRespondEnabled: true,
      autoCreateCasesEnabled: true,
      mayaPersonality: "empathetic",
    },
  });

  // Reset form when settings load from the server
  useEffect(() => {
    if (settings) {
      form.reset({
        twilioAccountSid: settings.twilioAccountSid || "",
        twilioAuthToken: settings.twilioAuthToken || "",
        twilioPhoneNumber: settings.twilioPhoneNumber || "",
        sendgridApiKey: settings.sendgridApiKey || "",
        sendgridFromEmail: settings.sendgridFromEmail || "",
        openaiApiKey: settings.openaiApiKey || "",
        autoRespondEnabled: settings.autoRespondEnabled ?? true,
        autoCreateCasesEnabled: settings.autoCreateCasesEnabled ?? true,
        mayaPersonality: settings.mayaPersonality || "empathetic",
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation<ChannelSettingsForm, Error, ChannelSettingsForm>({
    mutationFn: async (data: ChannelSettingsForm) => {
      const response = await apiRequest("PUT", "/api/channel-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/channel-settings'] });
      toast({
        title: "Settings Updated",
        description: "Channel settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update channel settings.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChannelSettingsForm) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <SettingsIcon className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title-channel-settings">⚙️ Channel Settings</h1>
        <p className="text-muted-foreground">
          Configure omnichannel communication integrations and AI behavior
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="twilio" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="twilio" data-testid="tab-twilio">
                <Phone className="h-4 w-4 mr-2" />
                Twilio
              </TabsTrigger>
              <TabsTrigger value="sendgrid" data-testid="tab-sendgrid">
                <Mail className="h-4 w-4 mr-2" />
                SendGrid
              </TabsTrigger>
              <TabsTrigger value="maya" data-testid="tab-maya">
                <Bot className="h-4 w-4 mr-2" />
                Maya AI
              </TabsTrigger>
              <TabsTrigger value="automation" data-testid="tab-automation">
                <MessageSquare className="h-4 w-4 mr-2" />
                Automation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="twilio" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Twilio Configuration</CardTitle>
                  <CardDescription>
                    Configure Twilio for SMS and voice call handling. Get your credentials from{" "}
                    <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Twilio Console
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="twilioAccountSid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account SID</FormLabel>
                        <FormControl>
                          <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} data-testid="input-twilio-sid" />
                        </FormControl>
                        <FormDescription>
                          Your Twilio Account SID
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twilioAuthToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••••••••••" {...field} data-testid="input-twilio-token" />
                        </FormControl>
                        <FormDescription>
                          Your Twilio Auth Token (kept secure)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twilioPhoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} data-testid="input-twilio-phone" />
                        </FormControl>
                        <FormDescription>
                          Your Twilio phone number in E.164 format
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sendgrid" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>SendGrid Configuration</CardTitle>
                  <CardDescription>
                    Configure SendGrid for email handling. Get your API key from{" "}
                    <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      SendGrid Settings
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sendgridApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="SG.••••••••••••••••" {...field} data-testid="input-sendgrid-key" />
                        </FormControl>
                        <FormDescription>
                          Your SendGrid API Key (kept secure)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sendgridFromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="property@yourdomain.com" {...field} data-testid="input-sendgrid-email" />
                        </FormControl>
                        <FormDescription>
                          Email address to send from (must be verified in SendGrid)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maya" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Maya AI Configuration</CardTitle>
                  <CardDescription>
                    Configure OpenAI for Maya's AI-powered responses and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="openaiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAI API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="sk-••••••••••••••••" {...field} data-testid="input-openai-key" />
                        </FormControl>
                        <FormDescription>
                          Your OpenAI API key for Maya's AI capabilities
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Maya Personality</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose how Maya communicates with tenants and contractors
                      </p>
                      <FormField
                        control={form.control}
                        name="mayaPersonality"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="flex gap-3">
                                <Button
                                  type="button"
                                  variant={field.value === "professional" ? "default" : "outline"}
                                  onClick={() => field.onChange("professional")}
                                  data-testid="button-personality-professional"
                                >
                                  Professional
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === "friendly" ? "default" : "outline"}
                                  onClick={() => field.onChange("friendly")}
                                  data-testid="button-personality-friendly"
                                >
                                  Friendly
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === "empathetic" ? "default" : "outline"}
                                  onClick={() => field.onChange("empathetic")}
                                  data-testid="button-personality-empathetic"
                                >
                                  Empathetic
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Automation Settings</CardTitle>
                  <CardDescription>
                    Control how Maya automatically handles incoming communications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="autoRespondEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto-Respond to Messages</FormLabel>
                          <FormDescription>
                            Maya will automatically respond to tenant and contractor messages
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-respond"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoCreateCasesEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto-Create Smart Cases</FormLabel>
                          <FormDescription>
                            Automatically create maintenance cases from urgent messages
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-create-cases"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-settings">
              {updateMutation.isPending ? (
                <>
                  <SettingsIcon className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
