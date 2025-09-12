import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Mail, User, Phone, Shield } from 'lucide-react';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export const CreateUserDialog = ({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'customer'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user via Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // The trigger creates profile and customer role automatically
        // We need to update the role if it's not customer, and update profile info
        
        if (formData.role !== 'customer') {
          // Update the role if different from default customer role
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: formData.role as 'admin' | 'driver' | 'customer' })
            .eq('user_id', data.user.id);

          if (roleError) throw roleError;
        }

        // Wait a moment for trigger, then update profile with additional info
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone
          })
          .eq('user_id', data.user.id);

        if (profileError) throw profileError;

        toast({
          title: 'Käyttäjä luotu',
          description: `Uusi käyttäjä ${formData.full_name} luotu onnistuneesti.`
        });

        setFormData({
          email: '',
          password: '',
          full_name: '',
          phone: '',
          role: 'customer'
        });

        onUserCreated();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: error.message || 'Käyttäjän luominen epäonnistui'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Luo uusi käyttäjä
          </DialogTitle>
          <DialogDescription>
            Täytä tiedot uuden käyttäjän luomiseksi
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Koko nimi *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                className="pl-10"
                placeholder="Koko nimi"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Sähköposti *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="pl-10"
                placeholder="sähköposti@example.com"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">Salasana *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Vähintään 6 merkkiä"
              minLength={6}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Puhelinnumero</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  // Only allow numbers, +, -, (, ), and spaces
                  const value = e.target.value.replace(/[^0-9\s\-\+\(\)]/g, '');
                  handleInputChange('phone', value);
                }}
                className="pl-10"
                placeholder="+358 40 123 4567"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="role">Rooli *</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Peruuta
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Luodaan...' : 'Luo käyttäjä'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};