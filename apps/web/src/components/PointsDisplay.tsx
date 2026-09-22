import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Gift, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';

interface PointsTransaction {
  id: string;
  points: number;
  transaction_type: 'earned' | 'redeemed' | 'expired';
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export const PointsDisplay = () => {
  const { user } = useAuth();
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPointsData();
    }
  }, [user]);

  const fetchPointsData = async () => {
    if (!user) return;

    try {
      // Fetch current balance from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('points_balance')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setPointsBalance(profile.points_balance || 0);
      }

      // Fetch recent transactions
      const { data: txns } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txns) {
        setTransactions(txns as PointsTransaction[]);
      }
    } catch (error) {
      console.error('Error fetching points data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'redeemed': return <Gift className="h-4 w-4 text-blue-500" />;
      case 'expired': return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return <Coins className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned': return 'text-green-600';
      case 'redeemed': return 'text-blue-600';
      case 'expired': return 'text-muted-foreground';
      default: return 'text-foreground';
    }
  };

  // Calculate euro value: 100 points = 2€
  const euroValue = (pointsBalance / 100) * 2;

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Bonuspisteet
        </CardTitle>
        <CardDescription>
          Kerää pisteitä tilauksista: 1 € = 1 piste
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Points Balance Display */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 text-center">
          <div className="text-4xl font-bold text-primary mb-1">
            {pointsBalance}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            pistettä
          </div>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm">
              Arvo: {euroValue.toFixed(2)} €
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            100 pistettä = 2 € alennus
          </p>
        </div>

        {/* Points Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>1 € tilauksesta = 1 piste</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 text-blue-500" />
            <span>100 pistettä = 2 € alennus</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Pisteet vanhenevat 12 kk kuluttua</span>
          </div>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Viimeisimmät tapahtumat</h4>
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(tx.transaction_type)}
                    <div>
                      <p className="text-sm font-medium">
                        {tx.description || (tx.transaction_type === 'earned' ? 'Pisteet tilauksesta' : 
                          tx.transaction_type === 'redeemed' ? 'Pisteet lunastettu' : 'Pisteet vanhenivat')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), 'd.M.yyyy', { locale: fi })}
                        {tx.expires_at && tx.transaction_type === 'earned' && (
                          <span className="ml-2">
                            • Vanhenee {format(new Date(tx.expires_at), 'd.M.yyyy', { locale: fi })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${getTransactionColor(tx.transaction_type)}`}>
                    {tx.transaction_type === 'earned' ? '+' : '-'}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {transactions.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ei vielä pistetapahtumia</p>
            <p className="text-xs">Tee tilaus ja kerää pisteitä!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
