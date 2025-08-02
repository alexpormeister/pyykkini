import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, User, Mail, Shield, Edit, UserPlus, Phone, MapPin, Trash2 } from 'lucide-react';
import { CreateUserDialog } from './CreateUserDialog';

interface UserWithRole {
  id: string;
  email: string;
  profiles?: {
    full_name?: string;
    phone?: string;
    address?: string;
  };
  user_roles?: {
    role: string;
  }[];
}

export const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles including address
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          full_name,
          phone,
          address
        `);

      if (error) throw error;

      // Fetch roles separately  
      const userIds = data?.map(p => p.user_id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Transform data structure
      const transformedUsers = data?.map(profile => ({
        id: profile.user_id,
        email: profile.email,
        profiles: {
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address
        },
        user_roles: rolesData?.filter(r => r.user_id === profile.user_id).map(r => ({ role: r.role })) || []
      })) || [];

      setUsers(transformedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Käyttäjien lataaminen epäonnistui'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      // First, delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole as 'admin' | 'driver' | 'customer'
        });

      if (error) throw error;

      toast({
        title: 'Rooli päivitetty',
        description: `Käyttäjän rooli muutettu: ${newRole}`
      });

      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: error.message || 'Roolin päivittäminen epäonnistui'
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setEditFormData({
      full_name: user.profiles?.full_name || '',
      email: user.email,
      phone: user.profiles?.phone || '',
      address: user.profiles?.address || ''
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.full_name,
          email: editFormData.email,
          phone: editFormData.phone,
          address: editFormData.address
        })
        .eq('user_id', editingUser.id);

      if (error) throw error;

      toast({
        title: 'Käyttäjä päivitetty',
        description: 'Käyttäjän tiedot on päivitetty onnistuneesti'
      });

      setShowEditDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: error.message || 'Käyttäjän päivittäminen epäonnistui'
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Oletko varma, että haluat poistaa käyttäjän ${userEmail}? Tätä toimintoa ei voi peruuttaa.`)) {
      return;
    }

    setDeletingUser(userId);
    try {
      // Delete user roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Delete profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Käyttäjä poistettu',
        description: 'Käyttäjä on poistettu onnistuneesti'
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: error.message || 'Käyttäjän poistaminen epäonnistui'
      });
    } finally {
      setDeletingUser(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'driver': return 'bg-blue-100 text-blue-800';
      case 'customer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Käyttäjähallinta
        </CardTitle>
        <CardDescription>Hallitse käyttäjien rooleja ja tietoja</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and Create User */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hae käyttäjiä (sähköposti, nimi...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <UserPlus className="h-4 w-4" />
            Luo käyttäjä
          </Button>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="border rounded-xl p-6 hover:shadow-elegant transition-all duration-300 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-primary">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">
                      {user.profiles?.full_name || user.email}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                    {user.profiles?.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {user.profiles.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge className={getRoleColor(user.user_roles?.[0]?.role || 'customer')} variant="secondary">
                      <Shield className="h-3 w-3 mr-1" />
                      {user.user_roles?.[0]?.role || 'customer'}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(user)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-3 w-3" />
                    Muokkaa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    disabled={deletingUser === user.id}
                    className="flex items-center gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingUser === user.id ? 'Poistetaan...' : 'Poista'}
                  </Button>
                  <Select
                    value={user.user_roles?.[0]?.role || 'customer'}
                    onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                    disabled={updatingRole === user.id}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Ei käyttäjiä löytynyt</p>
          </div>
        )}

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Muokkaa käyttäjää
              </DialogTitle>
              <DialogDescription>
                Päivitä käyttäjän tietoja
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_full_name">Koko nimi</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit_full_name"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="pl-10"
                    placeholder="Koko nimi"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_email">Sähköposti</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit_email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    placeholder="sähköposti@example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_phone">Puhelinnumero</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit_phone"
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                    placeholder="+358 40 123 4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_address">Osoite</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit_address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="pl-10"
                    placeholder="Osoite"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="flex-1"
                >
                  Peruuta
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                >
                  Tallenna
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onUserCreated={fetchUsers}
        />
      </CardContent>
    </Card>
  );
};