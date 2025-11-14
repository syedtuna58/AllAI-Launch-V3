import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

const ALL_SPECIALTIES = [
  'Appliance Repair',
  'Carpentry',
  'Cleaning',
  'Concrete',
  'Countertops',
  'Demolition',
  'Drywall',
  'Electrical',
  'Fencing',
  'Flooring',
  'General',
  'Gutter',
  'Handyman',
  'HVAC',
  'Insulation',
  'Landscaping',
  'Locksmith',
  'Masonry',
  'Other',
  'Painting',
  'Pest Control',
  'Plumbing',
  'Pool/Spa',
  'Roofing',
  'Siding',
  'Tile',
  'Window/Door',
].sort();

export function useTeamManagement() {
  const { toast } = useToast();
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [creatingNewTeam, setCreatingNewTeam] = useState(false);
  const [teamFormData, setTeamFormData] = useState({ 
    id: null as string | null, 
    name: '', 
    specialty: 'General', 
    color: '#3b82f6', 
    isActive: true 
  });

  // Favorite specialty helpers
  const getFavoriteSpecialties = (): string[] => {
    const stored = localStorage.getItem('favoriteSpecialties');
    return stored ? JSON.parse(stored) : [];
  };

  const toggleFavoriteSpecialty = (specialty: string) => {
    const favorites = getFavoriteSpecialties();
    const newFavorites = favorites.includes(specialty)
      ? favorites.filter(s => s !== specialty)
      : [...favorites, specialty];
    localStorage.setItem('favoriteSpecialties', JSON.stringify(newFavorites));
    setTeamFormData({ ...teamFormData });
  };

  const getSortedSpecialties = () => {
    const favorites = getFavoriteSpecialties();
    return {
      favoriteSpecs: ALL_SPECIALTIES.filter(spec => favorites.includes(spec)),
      otherSpecs: ALL_SPECIALTIES.filter(spec => !favorites.includes(spec)),
    };
  };

  // Reset form state
  const resetForm = () => {
    setEditingTeam(null);
    setCreatingNewTeam(false);
    setTeamFormData({ id: null, name: '', specialty: 'General', color: '#3b82f6', isActive: true });
  };

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team created successfully", duration: 2000 });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create team", description: error.message, variant: "destructive", duration: 4000 });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team updated successfully", duration: 2000 });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update team", description: error.message, variant: "destructive", duration: 4000 });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: "Team deleted successfully", duration: 2000 });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete team", description: error.message, variant: "destructive", duration: 4000 });
    },
  });

  // Handlers
  const handleEditTeam = (team: any) => {
    setEditingTeam(team);
    setCreatingNewTeam(false);
    setTeamFormData({
      id: team.id,
      name: team.name,
      specialty: team.specialty,
      color: team.color,
      isActive: team.isActive !== undefined ? team.isActive : true,
    });
  };

  const handleCreateTeam = () => {
    const { id, ...teamData } = teamFormData;
    if (editingTeam) {
      updateTeamMutation.mutate({ id: editingTeam.id, data: teamData });
    } else {
      createTeamMutation.mutate(teamData);
    }
  };

  const handleDeleteTeam = (teamId: string) => {
    if (confirm('Are you sure you want to delete this team?')) {
      deleteTeamMutation.mutate(teamId);
    }
  };

  return {
    // State
    editingTeam,
    setEditingTeam,
    creatingNewTeam,
    setCreatingNewTeam,
    teamFormData,
    setTeamFormData,
    
    // Constants
    PRESET_COLORS,
    ALL_SPECIALTIES,
    
    // Helpers
    getFavoriteSpecialties,
    toggleFavoriteSpecialty,
    getSortedSpecialties,
    resetForm,
    
    // Handlers
    handleEditTeam,
    handleCreateTeam,
    handleDeleteTeam,
    
    // Mutations
    createTeamMutation,
    updateTeamMutation,
    deleteTeamMutation,
  };
}
