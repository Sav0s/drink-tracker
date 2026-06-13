export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface Drink {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  created_at: string;
}

export interface BillingPeriod {
  id: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "closed";
  payment_instructions: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  player_id: string;
  drink_id: string;
  period_id: string;
  created_at: string;
  drink?: Drink;
}

export interface Payment {
  id: string;
  player_id: string;
  period_id: string;
  paid: boolean;
  paid_at: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
