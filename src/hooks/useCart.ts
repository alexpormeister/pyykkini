import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

export interface CartItem {
  id: string;
  type: 'service' | 'addon' | 'bundle';
  serviceId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  metadata?: {
    rugDimensions?: {
      length: number;
      width: number;
    };
    sockColor?: string;
    sockPairs?: number;
  };
}

export const useCart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load cart from database
  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      setCartItems([]);
      setCartId(null);
    }
  }, [user]);

  const loadCart = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get or create cart
      let { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cartError) throw cartError;

      if (!cart) {
        // Create new cart
        const { data: newCart, error: createError } = await supabase
          .from('carts')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        cart = newCart;
      }

      setCartId(cart.id);

      // Load cart items
      const { data: items, error: itemsError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id);

      if (itemsError) throw itemsError;

      // Convert database items to CartItem format
      const formattedItems: CartItem[] = (items || []).map(item => ({
        id: item.id,
        type: (item.metadata as any)?.type || 'service',
        serviceId: (item.metadata as any)?.serviceId || item.service_type,
        name: item.service_name,
        description: (item.metadata as any)?.description || '',
        price: Number(item.unit_price),
        quantity: item.quantity,
        metadata: (item.metadata as any)?.metadata || item.metadata
      }));

      setCartItems(formattedItems);
    } catch (error) {
      console.error('Error loading cart:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Ostoskorin lataaminen epäonnistui'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (item: Omit<CartItem, 'id'>) => {
    if (!user || !cartId) {
      toast({
        variant: 'destructive',
        title: 'Kirjaudu sisään',
        description: 'Sinun täytyy kirjautua sisään lisätäksesi tuotteita ostoskoriin'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cartId,
          service_type: item.type,
          service_name: item.name,
          unit_price: item.price,
          quantity: item.quantity,
          metadata: {
            type: item.type,
            serviceId: item.serviceId,
            description: item.description,
            metadata: item.metadata
          }
        })
        .select()
        .single();

      if (error) throw error;

      const newItem: CartItem = {
        id: data.id,
        type: item.type,
        serviceId: item.serviceId,
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: item.quantity,
        metadata: item.metadata
      };

      setCartItems([...cartItems, newItem]);
      
      toast({
        title: 'Lisätty ostoskoriin',
        description: `${item.name} lisätty`
      });
    } catch (error) {
      console.error('Error adding item:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Tuotteen lisääminen epäonnistui'
      });
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      await removeItem(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;

      setCartItems(cartItems.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Määrän päivittäminen epäonnistui'
      });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setCartItems(cartItems.filter(item => item.id !== itemId));
      
      toast({
        title: 'Poistettu',
        description: 'Tuote poistettu ostoskorista'
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Tuotteen poistaminen epäonnistui'
      });
    }
  };

  const clearCart = async () => {
    if (!cartId) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (error) throw error;

      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast({
        variant: 'destructive',
        title: 'Virhe',
        description: 'Ostoskorin tyhjentäminen epäonnistui'
      });
    }
  };

  return {
    cartItems,
    isLoading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart
  };
};
