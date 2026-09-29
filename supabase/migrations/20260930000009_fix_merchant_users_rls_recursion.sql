-- Migration: 20260930000009_fix_merchant_users_rls_recursion.sql
-- Description: Resolve infinite recursion in merchant_users RLS policy using SECURITY DEFINER helper functions

-- 1. Helper function to check if current user is an employee/member of a merchant (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_merchant_user_of(p_merchant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users
    WHERE merchant_id = p_merchant_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Helper function to check if current user can manage orders for a specific store/branch
CREATE OR REPLACE FUNCTION public.can_user_manage_store_orders(p_store_id UUID, p_branch_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_users mu
    JOIN public.stores s ON s.merchant_id = mu.merchant_id
    WHERE mu.user_id = auth.uid()
      AND s.id = p_store_id
      AND (mu.branch_id IS NULL OR mu.branch_id = p_branch_id)
      AND mu.can_manage_orders = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Fix merchant_users SELECT policy to prevent self-referencing recursion
DROP POLICY IF EXISTS "الإدارة والتاجر يقرؤون مستخدمي التاجر" ON public.merchant_users;
CREATE POLICY "الإدارة والتاجر يقرؤون مستخدمي التاجر"
  ON public.merchant_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_merchant_user_of(merchant_id)
  );

-- 4. Update orders_merchant_select policy to use helper function
DROP POLICY IF EXISTS orders_merchant_select ON public.orders;
CREATE POLICY orders_merchant_select ON public.orders
FOR SELECT USING (
  public.can_user_manage_store_orders(store_id, branch_id)
);

-- 5. Update order_history_merchant_select policy
DROP POLICY IF EXISTS order_history_merchant_select ON public.order_status_history;
CREATE POLICY order_history_merchant_select ON public.order_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND public.can_user_manage_store_orders(o.store_id, o.branch_id)
  )
);
