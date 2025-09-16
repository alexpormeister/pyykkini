-- Add cancelled status to the order_status enum if needed
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Fix any issues with order status values in the database
UPDATE orders 
SET status = 'rejected' 
WHERE status NOT IN ('pending', 'accepted', 'picking_up', 'washing', 'returning', 'delivered', 'rejected');

-- Create an index on orders table for better performance
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON orders(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_driver_id ON orders(status, driver_id);