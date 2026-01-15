import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // Dynamic import to avoid errors if Stripe is not installed
    const Stripe = (await import("stripe")).default;
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin operations
    );

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    try {
      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;

          if (userId) {
            // Update user's subscription tier in Supabase
            const { error } = await supabase.auth.admin.updateUserById(userId, {
              user_metadata: {
                subscriptionTier: "premium",
                stripeCustomerId: session.customer,
              },
            });

            if (error) {
              console.error("Error updating user metadata:", error);
            }
          }
          break;
        }

        case "customer.subscription.deleted":
        case "invoice.payment_failed": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID and downgrade to free
          const { data: users } = await supabase.auth.admin.listUsers();
          const user = users?.users.find(
            (u) => u.user_metadata?.stripeCustomerId === customerId
          );

          if (user) {
            await supabase.auth.admin.updateUserById(user.id, {
              user_metadata: {
                subscriptionTier: "free",
              },
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return NextResponse.json({ received: true });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
      return NextResponse.json(
        { error: "Webhook handler failed" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error initializing Stripe:", error);
    return NextResponse.json(
      { error: "Stripe initialization failed" },
      { status: 500 }
    );
  }
}
