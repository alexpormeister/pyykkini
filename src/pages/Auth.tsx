import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth, CUSTOMER_WEB_BLOCK_KEY } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const Auth = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [customerBlocked, setCustomerBlocked] = useState(false);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  useEffect(() => {
    if (user) navigate('/app');
  }, [user, navigate]);

  // Näytetään ilmoitus, jos asiakastilillä yritettiin kirjautua selaimeen
  useEffect(() => {
    const id = window.setInterval(() => {
      if (localStorage.getItem(CUSTOMER_WEB_BLOCK_KEY) === '1') {
        localStorage.removeItem(CUSTOMER_WEB_BLOCK_KEY);
        setCustomerBlocked(true);
        setLoading(false);
      }
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCustomerBlocked(false);

    try {
      const { error } = await signIn(signInEmail, signInPassword);

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Kirjautuminen epäonnistui',
          description:
            error.message === 'Invalid login credentials'
              ? 'Väärä sähköposti tai salasana'
              : error.message,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Jokin meni pieleen. Yritä uudelleen.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;

      toast({
        title: 'Sähköposti lähetetty',
        description: 'Tarkista sähköpostisi ja seuraa ohjeita salasanan vaihtamiseksi.',
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: (error as Error)?.message || 'Salasanan palautus epäonnistui',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Pesuni
            </CardTitle>
            <CardDescription>Kirjautuminen henkilöstölle (ylläpito, kuljettajat, pesulat)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customerBlocked && (
              <Alert variant="destructive">
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Asiakastili toimii vain mobiilisovelluksessa</AlertTitle>
                <AlertDescription>
                  Tilaaminen ja tilausten seuranta tapahtuvat Pesuni-sovelluksessa. Selaimen kirjautuminen on
                  tarkoitettu vain henkilöstölle.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Sähköposti</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="pl-10"
                    placeholder="nimi@pesuni.fi"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Salasana</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-muted-foreground"
                >
                  Unohtuiko salasana?
                </Button>
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Kirjaudu sisään
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Oletko asiakas? Tilaaminen tapahtuu Pesuni-mobiilisovelluksessa.
            </p>
          </CardContent>
        </Card>

        {showForgotPassword && (
          <Card className="shadow-elegant">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Salasanan palautus</CardTitle>
              <CardDescription>
                Anna sähköpostiosoitteesi, niin lähetämme sinulle linkin salasanan vaihtamiseksi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Sähköposti</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="pl-10"
                      placeholder="nimi@pesuni.fi"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1"
                  >
                    Peruuta
                  </Button>
                  <Button type="submit" variant="hero" className="flex-1" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lähetä
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
