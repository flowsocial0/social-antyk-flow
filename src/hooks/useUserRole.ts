import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'moderator' | 'user';

export const useUserRole = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRoles([]);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Use any to bypass type checking for new table
        const { data, error } = await (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
          setIsAdmin(false);
        } else {
          const userRoles = (data || []).map((r: any) => r.role as AppRole);
          setRoles(userRoles);
          setIsAdmin(userRoles.includes('admin'));
        }
      } catch (err) {
        console.error('Error in useUserRole:', err);
        setRoles([]);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  return { roles, loading, isAdmin, hasRole };
};
