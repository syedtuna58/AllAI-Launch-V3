import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Edit, Trash2 } from 'lucide-react';
import type { UserCategory, UserCategoryMember, User } from '@shared/schema';

export default function Categories() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<UserCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#0080FF',
    icon: 'Users'
  });

  const { data: categories = [], isLoading } = useQuery<UserCategory[]>({
    queryKey: ['/api/categories'],
  });

  const { data: orgUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: categoryMembers = [] } = useQuery<UserCategoryMember[]>({
    queryKey: ['/api/categories', selectedCategory?.id, 'members'],
    enabled: !!selectedCategory,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/categories', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setShowCreateDialog(false);
      setFormData({ name: '', description: '', color: '#0080FF', icon: 'Users' });
      toast({
        title: 'Success',
        description: 'Category created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create category',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await apiRequest('DELETE', `/api/categories/${categoryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ categoryId, userId }: { categoryId: string; userId: string }) => {
      const response = await apiRequest('POST', `/api/categories/${categoryId}/members`, { userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories', selectedCategory?.id, 'members'] });
      toast({
        title: 'Success',
        description: 'Member added successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add member',
        variant: 'destructive',
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ categoryId, userId }: { categoryId: string; userId: string }) => {
      const response = await apiRequest('DELETE', `/api/categories/${categoryId}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories', selectedCategory?.id, 'members'] });
      toast({
        title: 'Success',
        description: 'Member removed successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });

  const handleCreateCategory = () => {
    createCategoryMutation.mutate(formData);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const handleAddMember = (userId: string) => {
    if (selectedCategory) {
      addMemberMutation.mutate({ categoryId: selectedCategory.id, userId });
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (selectedCategory) {
      removeMemberMutation.mutate({ categoryId: selectedCategory.id, userId });
    }
  };

  const memberUserIds = categoryMembers.map(m => m.userId);
  const availableUsers = orgUsers.filter(u => !memberUserIds.includes(u.id));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="User Categories" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">User Categories</h2>
            <p className="text-muted-foreground">Manage custom user roles and permissions</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-category">
            <Plus className="h-4 w-4 mr-2" />
            Create Category
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading categories...</div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No categories yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card key={category.id} data-testid={`card-category-${category.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: category.color || '#0080FF' }}
                      />
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowMembersDialog(true);
                        }}
                        data-testid={`button-manage-members-${category.id}`}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                        data-testid={`button-delete-${category.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {category.description && (
                    <CardDescription>{category.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Create Category Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Registered Nurses, Medical Doctors"
                  data-testid="input-category-name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this category..."
                  data-testid="input-category-description"
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                    data-testid="input-category-color"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#0080FF"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCategory} data-testid="button-save-category">
                  Create Category
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Members Dialog */}
        <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Members - {selectedCategory?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Current Members</Label>
                <div className="mt-2 space-y-2">
                  {categoryMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  ) : (
                    categoryMembers.map((member) => {
                      const user = orgUsers.find(u => u.id === member.userId);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 border rounded"
                          data-testid={`member-${member.userId}`}
                        >
                          <div>
                            <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.userId)}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div>
                <Label>Add Members</Label>
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All users are already members</p>
                  ) : (
                    availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 border rounded"
                        data-testid={`available-user-${user.id}`}
                      >
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddMember(user.id)}
                          data-testid={`button-add-member-${user.id}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}
