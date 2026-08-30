import { useState, useEffect } from "react";

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  features: string[];
}

export interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd: string;
}

export function useSaas(userId?: string) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSaasData() {
      try {
        // Fetch plans
        const resPlans = await fetch("/api/saas/plans");
        if (resPlans.ok) {
          const data = await resPlans.json();
          setPlans(data.plans || []);
        }

        // Fetch subscription if user is logged in
        if (userId) {
          const resSub = await fetch("/api/saas/subscription");
          if (resSub.ok) {
            const subData = await resSub.json();
            setSubscription(subData.subscription || null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch SaaS data", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSaasData();
  }, [userId]);

  return { plans, subscription, isLoading };
}
