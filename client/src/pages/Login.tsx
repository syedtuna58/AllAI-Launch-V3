import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default function Login() {
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailSchema>) => {
      const res = await apiRequest('/api/auth/magic-link', {
        method: 'POST',
        body: data,
      });
      return res;
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: 'Magic link sent!',
        description: 'Check your email for a link to sign in.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send magic link. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="you@example.com" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-send-magic-link">
                  {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Mail className="mr-2 h-4 w-4" />
                  Send Magic Link
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center py-8">
              <Mail className="mx-auto h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Check your email</h3>
              <p className="text-sm text-muted-foreground">
                We've sent a magic link to <strong>{form.getValues('email')}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Click the link in the email to sign in.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setEmailSent(false)}
                data-testid="button-try-again"
              >
                Try a different email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
