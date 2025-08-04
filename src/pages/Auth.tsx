import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Phone, MapPin, ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Auth = () => {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  
  // Form states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpAddress, setSignUpAddress] = useState('');
  const [showExtraFields, setShowExtraFields] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(signInEmail, signInPassword);
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Kirjautuminen epäonnistui",
          description: error.message === 'Invalid login credentials' 
            ? 'Väärä sähköposti tai salasana' 
            : error.message
        });
      } else {
        toast({
          title: "Tervetuloa takaisin!",
          description: "Kirjautuminen onnistui"
        });
        navigate('/app');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Jokin meni pieleen. Yritä uudelleen."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInitialSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpEmail || !signUpPassword || !signUpFullName) {
      toast({
        variant: "destructive",
        title: "Täytä kaikki kentät",
        description: "Sähköposti, salasana ja nimi ovat pakollisia."
      });
      return;
    }
    setShowExtraFields(true);
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
        title: "Sähköposti lähetetty",
        description: "Tarkista sähköpostisi ja seuraa ohjeita salasanan vaihtamiseksi."
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: error.message || "Salasanan palautus epäonnistui"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signUpPhone || !signUpAddress) {
      toast({
        variant: "destructive",
        title: "Täytä kaikki kentät",
        description: "Puhelinnumero ja osoite ovat pakollisia tilauksen tekemiseen."
      });
      return;
    }

    // Validate phone number - only allow numbers, +, -, and spaces
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(signUpPhone)) {
      toast({
        variant: "destructive",
        title: "Virheellinen puhelinnumero",
        description: "Puhelinnumero saa sisältää vain numeroita ja merkkejä +, -, (, )."
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(signUpEmail, signUpPassword, signUpFullName);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            variant: "destructive",
            title: "Käyttäjä on jo olemassa",
            description: "Tämä sähköpostiosoite on jo rekisteröity. Kokeile kirjautumista."
          });
        } else {
          toast({
            variant: "destructive",
            title: "Rekisteröinti epäonnistui",
            description: error.message
          });
        }
      } else {
        // Update profile with phone and address
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({
              phone: signUpPhone,
              address: signUpAddress
            })
            .eq('user_id', user.id);
        }

        toast({
          title: "Rekisteröinti onnistui!",
          description: "Voit nyt kirjautua sisään."
        });
        
        // Clear form and reset to first step
        setSignUpEmail('');
        setSignUpPassword('');
        setSignUpFullName('');
        setSignUpPhone('');
        setSignUpAddress('');
        setShowExtraFields(false);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Jokin meni pieleen. Yritä uudelleen."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Pesuni
            </CardTitle>
            <CardDescription>
              Kirjaudu sisään tai luo uusi asiakastili
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Kirjaudu</TabsTrigger>
                <TabsTrigger value="signup">Rekisteröidy</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
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
                        placeholder="anna@example.com"
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
                  <Button 
                    type="submit" 
                    variant="hero" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Kirjaudu sisään
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                {!showExtraFields ? (
                  <form onSubmit={handleInitialSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Koko nimi</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          value={signUpFullName}
                          onChange={(e) => setSignUpFullName(e.target.value)}
                          className="pl-10"
                          placeholder="Anna Asiakas"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Sähköposti</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          className="pl-10"
                          placeholder="anna@example.com"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Salasana</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          className="pl-10"
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      variant="hero" 
                      className="w-full"
                    >
                      Jatka
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleCompleteSignUp} className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowExtraFields(false)}
                        className="flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Takaisin
                      </Button>
                      <span className="text-sm text-muted-foreground">Vielä kaksi kenttää...</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Puhelinnumero *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                         <Input
                           id="signup-phone"
                           type="tel"
                           value={signUpPhone}
                           onChange={(e) => {
                             // Only allow numbers, +, -, (, ), and spaces
                             const value = e.target.value.replace(/[^0-9\s\-\+\(\)]/g, '');
                             setSignUpPhone(value);
                           }}
                           className="pl-10"
                           placeholder="+358 40 123 4567"
                           required
                         />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-address">Osoite *</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-address"
                          value={signUpAddress}
                          onChange={(e) => setSignUpAddress(e.target.value)}
                          className="pl-10"
                          placeholder="Katu 1, 00100 Helsinki"
                          required
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      * Tarvitsemme puhelinnumerosi ja osoitteesi tilausten toimittamiseen
                    </p>
                    
                    <Button 
                      type="submit" 
                      variant="hero" 
                      className="w-full" 
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Luo asiakastili
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Forgot Password Dialog */}
        {showForgotPassword && (
          <Card className="shadow-elegant mt-4">
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
                      placeholder="anna@example.com"
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
                  <Button 
                    type="submit" 
                    variant="hero" 
                    className="flex-1" 
                    disabled={loading}
                  >
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