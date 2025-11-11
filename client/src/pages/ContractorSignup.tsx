import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TIER_NAMES: Record<string, string> = {
  tier1: 'Tier 1: Essential Services',
  tier2: 'Tier 2: Specialized Trades',
  tier3: 'Tier 3: Premium Services',
  tier4: 'Tier 4: Emergency Services',
  tier5: 'Tier 5: Technology & Security',
  tier6: 'Tier 6: Specialty Services',
};

type SignupStep = 'email' | 'phone' | 'verify-phone' | 'specialties' | 'complete';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

const verifyPhoneSchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const specialtiesSchema = z.object({
  specialtyIds: z.array(z.string()).min(1, 'Select at least one specialty'),
  bio: z.string().optional(),
});

export default function ContractorSignup() {
  const [step, setStep] = useState<SignupStep>('email');
  const [userId, setUserId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set());
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['tier1']));
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch specialties
  const { data: specialties, isLoading: specialtiesLoading } = useQuery<any[]>({
    queryKey: ['/api/contractor-specialties'],
    enabled: step === 'specialties',
  });

  // Group specialties by tier
  const specialtiesByTier = specialties?.reduce((acc, specialty) => {
    if (!acc[specialty.tier]) {
      acc[specialty.tier] = [];
    }
    acc[specialty.tier].push(specialty);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Email signup mutation
  const emailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/email', {
        method: 'POST',
        body: data,
      });
      return res;
    },
    onSuccess: (data) => {
      setUserId(data.userId);
      toast({
        title: 'Email sent!',
        description: 'Check your email for a verification link.',
      });
      setStep('phone');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send verification email. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Phone verification mutation
  const phoneMutation = useMutation({
    mutationFn: async (data: z.infer<typeof phoneSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/phone', {
        method: 'POST',
        body: { userId, phone: data.phone },
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: 'Code sent!',
        description: 'Check your phone for a verification code.',
      });
      setStep('verify-phone');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send verification code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Verify phone mutation
  const verifyPhoneMutation = useMutation({
    mutationFn: async (data: z.infer<typeof verifyPhoneSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/verify-phone', {
        method: 'POST',
        body: { phone, code: data.code },
      });
      return res;
    },
    onSuccess: () => {
      toast({
        title: 'Phone verified!',
        description: 'Now select your specialties.',
      });
      setStep('specialties');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Invalid or expired code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Complete signup mutation
  const completeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof specialtiesSchema>) => {
      const res = await apiRequest('/api/auth/signup-contractor/complete', {
        method: 'POST',
        body: { userId, specialtyIds: data.specialtyIds, bio: data.bio },
      });
      return res;
    },
    onSuccess: (data) => {
      // Store session
      localStorage.setItem('refreshToken', data.session.refreshToken);
      localStorage.setItem('sessionId', data.session.sessionId);
      toast({
        title: 'Welcome!',
        description: 'Your contractor account is ready.',
      });
      navigate('/contractor-dashboard');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete signup. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Email form
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
    },
  });

  // Phone form
  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: '',
    },
  });

  // Verify phone form
  const verifyPhoneForm = useForm({
    resolver: zodResolver(verifyPhoneSchema),
    defaultValues: {
      code: '',
    },
  });

  // Specialties form
  const specialtiesForm = useForm({
    resolver: zodResolver(specialtiesSchema),
    defaultValues: {
      specialtyIds: [],
      bio: '',
    },
  });

  const toggleSpecialty = (specialtyId: string) => {
    const newSelected = new Set(selectedSpecialties);
    if (newSelected.has(specialtyId)) {
      newSelected.delete(specialtyId);
    } else {
      newSelected.add(specialtyId);
    }
    setSelectedSpecialties(newSelected);
    specialtiesForm.setValue('specialtyIds', Array.from(newSelected));
  };

  const toggleTier = (tier: string) => {
    const newExpanded = new Set(expandedTiers);
    if (newExpanded.has(tier)) {
      newExpanded.delete(tier);
    } else {
      newExpanded.add(tier);
    }
    setExpandedTiers(newExpanded);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Contractor Signup</CardTitle>
          <CardDescription>
            Join our contractor marketplace and get access to maintenance jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step indicators */}
          <div className="flex justify-between mb-8">
            <div className={`flex items-center ${step === 'email' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step !== 'email' ? 'bg-primary text-primary-foreground' : 'border-2'}`}>
                {step !== 'email' ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className="ml-2 text-sm">Email</span>
            </div>
            <div className={`flex items-center ${step === 'phone' || step === 'verify-phone' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'specialties' || step === 'complete' ? 'bg-primary text-primary-foreground' : step === 'phone' || step === 'verify-phone' ? 'border-2' : 'border-2 border-muted-foreground'}`}>
                {step === 'specialties' || step === 'complete' ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className="ml-2 text-sm">Phone</span>
            </div>
            <div className={`flex items-center ${step === 'specialties' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'complete' ? 'bg-primary text-primary-foreground' : step === 'specialties' ? 'border-2' : 'border-2 border-muted-foreground'}`}>
                {step === 'complete' ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <span className="ml-2 text-sm">Specialties</span>
            </div>
          </div>

          {/* Email step */}
          {step === 'email' && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit((data) => emailMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={emailMutation.isPending} data-testid="button-submit-email">
                  {emailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </form>
            </Form>
          )}

          {/* Phone step */}
          {step === 'phone' && (
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit((data) => { setPhone(data.phone); phoneMutation.mutate(data); })} className="space-y-4">
                <FormField
                  control={phoneForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" placeholder="+1234567890" data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={phoneMutation.isPending} data-testid="button-submit-phone">
                  {phoneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Verification Code
                </Button>
              </form>
            </Form>
          )}

          {/* Verify phone step */}
          {step === 'verify-phone' && (
            <Form {...verifyPhoneForm}>
              <form onSubmit={verifyPhoneForm.handleSubmit((data) => verifyPhoneMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={verifyPhoneForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123456" maxLength={6} data-testid="input-verification-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={verifyPhoneMutation.isPending} data-testid="button-verify-phone">
                  {verifyPhoneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Phone
                </Button>
              </form>
            </Form>
          )}

          {/* Specialties step */}
          {step === 'specialties' && (
            <Form {...specialtiesForm}>
              <form onSubmit={specialtiesForm.handleSubmit((data) => completeMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Select Your Specialties</FormLabel>
                  <p className="text-sm text-muted-foreground">Choose the services you provide</p>
                  
                  {specialtiesLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto border rounded-md p-2">
                      {Object.entries(specialtiesByTier).sort().map(([tier, specs]) => (
                        <div key={tier} className="border rounded-lg">
                          <button
                            type="button"
                            onClick={() => toggleTier(tier)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
                            data-testid={`toggle-tier-${tier}`}
                          >
                            <span className="font-medium">{TIER_NAMES[tier]}</span>
                            {expandedTiers.has(tier) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {expandedTiers.has(tier) && (
                            <div className="px-4 pb-2 space-y-2">
                              {specs.map((specialty) => (
                                <div key={specialty.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={specialty.id}
                                    checked={selectedSpecialties.has(specialty.id)}
                                    onCheckedChange={() => toggleSpecialty(specialty.id)}
                                    data-testid={`checkbox-specialty-${specialty.id}`}
                                  />
                                  <label htmlFor={specialty.id} className="text-sm cursor-pointer">
                                    {specialty.name}
                                    {specialty.description && (
                                      <span className="text-muted-foreground ml-2">- {specialty.description}</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedSpecialties.size > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedSpecialties.size} {selectedSpecialties.size === 1 ? 'specialty' : 'specialties'} selected
                    </p>
                  )}
                </div>

                <FormField
                  control={specialtiesForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio (Optional)</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          className="w-full min-h-24 p-2 border rounded-md"
                          placeholder="Tell us about your experience..."
                          data-testid="textarea-bio"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={completeMutation.isPending || selectedSpecialties.size === 0} data-testid="button-complete-signup">
                  {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Signup
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
